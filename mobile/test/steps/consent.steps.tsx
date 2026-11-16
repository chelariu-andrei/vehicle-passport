import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';
import { Text } from 'react-native';

import { AUTO_ACCEPT_TIMEOUT_MS } from '@/features/account/api/useConsentGate';
import { PENDING_CONSENT_KEY, rememberPendingConsent } from '@/features/auth/model/pendingConsent';
import { en } from '@/shared/i18n/en';

import { openApp } from '../harness';
import type { FakeApi } from '../fake-api';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/consent.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const acceptButton = () => screen.getByRole('button', { name: en.consent.accept });
const termsBox = () => screen.getByRole('checkbox', { name: new RegExp(en.auth.termsLabel) });
const marketing = () => screen.getByRole('switch', { name: en.consent.marketing });
const analytics = () => screen.getByRole('switch', { name: en.consent.analytics });
const seeGate = async () => {
  expect(await screen.findByText(en.consent.title)).toBeTruthy();
  expect(screen).toHavePathname('/consent');
};

/** Waits for the remembered sign-up consent to be removed (storage is read outside act, so not through waitFor). */
async function flagGone(): Promise<boolean> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await AsyncStorage.getItem(PENDING_CONSENT_KEY)) === null) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return false;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let seeds: ((api: FakeApi) => void)[] = [];
  beforeEach(() => {
    seeds = [];
  });
  const acceptedNothing = () => {
    seeds.push((api) => {
      api.state.account.accepted = { terms: null, privacy: null };
    });
  };
  const open = async (routes: Record<string, () => React.ReactElement | null> = {}) => {
    fake = await openApp('/', { routes: { ...inertTabs, ...routes }, seed: (api) => seeds.forEach((seed) => seed(api)) });
  };
  const signedUpWithPendingConsent = async () => {
    acceptedNothing();
    // Typed unlike the session's owner@example.com: the match ignores case and spaces.
    await rememberPendingConsent(' Owner@Example.com ');
  };

  test('New Apple user is taken to the consent screen', ({ given, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('the app opens', () => open());
    then('I am on the consent screen', seeGate);
  });

  test('Accept is disabled until the box is ticked', ({ given, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('the app opens', () => open());
    then('Accept and continue is disabled until I tick the terms box', async () => {
      await seeGate();
      expect(acceptButton()).toBeDisabled();
      await fireEvent.press(termsBox());
      expect(acceptButton()).toBeEnabled();
    });
  });

  test('Optional switches default off', ({ given, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('the app opens', () => open());
    then('the marketing and analytics switches are off', async () => {
      await seeGate();
      expect(marketing().props.accessibilityState).toMatchObject({ checked: false });
      expect(analytics().props.accessibilityState).toMatchObject({ checked: false });
    });
  });

  test('Accepting with the optional switches records my choices', ({ given, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('I tick the box, turn marketing on and accept', async () => {
      await open();
      await seeGate();
      await fireEvent.press(termsBox());
      await fireEvent(marketing(), 'valueChange', true);
      await fireEvent.press(acceptButton());
    });
    then('the server records the current versions and marketing, and I land on the garage', async () => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(fake.callsTo('recordConsents')[0].body).toEqual({
        accept: [
          { type: 'terms', version: '1.0' },
          { type: 'privacy', version: '1.0' },
        ],
        marketing: true,
        analytics: false,
        source: 'social-sign-up',
      });
    });
  });

  test('Terms open from the consent screen', ({ given, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('I tap Terms on the consent screen', async () => {
      await open({ 'account/legal/[type]': () => <Text>Legal text</Text> });
      await seeGate();
      await fireEvent.press(screen.getAllByText(en.auth.terms)[0]);
    });
    then('I read the terms', async () => {
      expect(await screen.findByText('Legal text')).toBeTruthy();
      expect(screen).toHavePathname('/account/legal/terms');
    });
  });

  test('Sign-up with ticked box and pending consent skips the gate', ({ given, when, then }) => {
    given('I ticked the terms at sign-up and then confirmed my email', signedUpWithPendingConsent);
    when('the app opens', () => open());
    then('the consent is recorded as the sign-up form and I land on the garage', async () => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(screen.queryByText(en.consent.title)).toBeNull();
      expect(fake.callsTo('recordConsents')).toHaveLength(1);
      expect(fake.callsTo('recordConsents')[0].body).toMatchObject({ source: 'sign-up-form' });
      expect(await flagGone()).toBe(true);
    });
  });

  test('A failed automatic acceptance shows the gate', ({ given, and, when, then }) => {
    given('I ticked the terms at sign-up and then confirmed my email', signedUpWithPendingConsent);
    and('the server cannot record consents', () => {
      seeds.push((api) => api.failNext('recordConsents', 503, 'unavailable'));
    });
    when('the app opens', () => open());
    then('I am on the consent screen', seeGate);
  });

  test('Another account does not inherit the sign-up consent', ({ given, and, when, then }) => {
    given('someone ticked the terms at sign-up as another email and never confirmed', async () => {
      await rememberPendingConsent('other@example.com');
    });
    and('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('the app opens', () => open());
    then('I am on the consent screen', seeGate);
    and('nothing was recorded and the remembered consent is gone', async () => {
      expect(fake.callsTo('recordConsents')).toHaveLength(0);
      expect(await flagGone()).toBe(true);
    });
  });

  test('Pending consent is dropped when nothing is owed', ({ given, and, when, then }) => {
    given('I ticked the terms at sign-up and then confirmed my email', signedUpWithPendingConsent);
    and('I have accepted the current terms', () => {
      seeds.length = 0;
    });
    when('the app opens and I reach the garage', async () => {
      await open();
      await waitFor(() => expect(screen).toHavePathname('/'));
    });
    then('the remembered consent is gone', async () => {
      expect(await flagGone()).toBe(true);
    });
    and('a new terms version later shows the gate and records nothing by itself', async () => {
      await waitFor(() => expect(fake.callsTo('getMe')).toHaveLength(1));
      fake.state.account.legalVersion = '2.0';
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await seeGate();
      expect(fake.callsTo('recordConsents')).toHaveLength(0);
    });
  });

  test('A hanging automatic acceptance falls back to the gate', ({ given, and, when, then }) => {
    given('I ticked the terms at sign-up and then confirmed my email', signedUpWithPendingConsent);
    and('the server never answers the consent request', () => {
      seeds.push(() => {
        const answering = globalThis.fetch;
        globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
          const request = input instanceof Request ? input : new Request(input, init);
          return request.method === 'POST' && request.url.endsWith('/me/consents') ? new Promise<Response>(() => {}) : answering(request);
        }) as typeof fetch;
      });
    });
    when('the app opens and the wait runs out', async () => {
      jest.useFakeTimers({ advanceTimers: true });
      await open();
      await waitFor(() => expect(screen.queryByText(en.consent.title)).toBeNull());
      await act(async () => {
        jest.advanceTimersByTime(AUTO_ACCEPT_TIMEOUT_MS);
      });
    });
    then('I am on the consent screen', seeGate);
    and('I can sign out from it', async () => {
      expect(screen.getByRole('button', { name: en.consent.signOut })).toBeTruthy();
    });
  });

  test('New terms version re-opens the gate on focus', ({ given, when, then }) => {
    given('I have accepted the current terms and use the app', () => {});
    when('the terms version is raised and the app comes back to the foreground', async () => {
      await open();
      await waitFor(() => expect(screen).toHavePathname('/'));
      await waitFor(() => expect(fake.callsTo('getMe')).toHaveLength(1));
      fake.state.account.legalVersion = '2.0';
      await act(async () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
    });
    then('I am on the consent screen', seeGate);
  });

  test('409 outdated version reloads the texts', ({ given, when, then, and }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('the terms change while I read, and I accept', async () => {
      await open();
      await seeGate();
      fake.state.account.legalVersion = '2.0';
      await fireEvent.press(termsBox());
      await fireEvent.press(acceptButton());
    });
    then('I stay on the consent screen with the newest version loaded', async () => {
      expect(await screen.findByText(en.errors.codes['consent-version-outdated'])).toBeTruthy();
      expect(screen).toHavePathname('/consent');
      await waitFor(() => expect(fake.callsTo('getMe').length).toBeGreaterThanOrEqual(2));
    });
    and('accepting again records the newest version', async () => {
      // New texts need a fresh yes: the box was cleared.
      await waitFor(() => expect(termsBox().props.accessibilityState).toMatchObject({ checked: false }));
      expect(acceptButton()).toBeDisabled();
      await fireEvent.press(termsBox());
      await fireEvent.press(acceptButton());
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(fake.callsTo('recordConsents')[1].body).toMatchObject({
        accept: [
          { type: 'terms', version: '2.0' },
          { type: 'privacy', version: '2.0' },
        ],
      });
    });
  });

  test('Offline shows retry and never opens the app', ({ given, and, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    and('my profile cannot be loaded', () => {
      seeds.push((api) => api.failNext('getMe', 503, 'unavailable'));
    });
    when('the app opens', () => open());
    then('I see a retry button and nothing is accepted', async () => {
      expect(await screen.findByRole('button', { name: en.common.retry })).toBeTruthy();
      expect(screen.queryByText(en.consent.title)).toBeNull();
      expect(fake.callsTo('recordConsents')).toHaveLength(0);
    });
    and('retrying brings me to the consent screen', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));
      await seeGate();
      expect(fake.callsTo('recordConsents')).toHaveLength(0);
    });
  });

  test('Sign out from the gate works', ({ given, when, then }) => {
    given('I signed in for the first time and have accepted nothing', acceptedNothing);
    when('I sign out from the consent screen', async () => {
      await open();
      await seeGate();
      await fireEvent.press(screen.getByRole('button', { name: en.consent.signOut }));
    });
    then('I am on sign-in', async () => {
      await waitFor(() => expect(screen).toHavePathname('/sign-in'));
    });
  });
});
