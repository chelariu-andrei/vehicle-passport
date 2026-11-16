import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import { openApp, reopenApp } from '../harness';
import type { FakeApi } from '../fake-api';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/privacy.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const marketing = () => screen.findByRole('switch', { name: en.privacy.marketing });
const analytics = () => screen.findByRole('switch', { name: en.privacy.analytics });

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let seeds: ((api: FakeApi) => void)[] = [];
  beforeEach(() => {
    seeds = [];
  });
  const agreedToNews = () => {
    seeds.push((api) => {
      api.state.account.marketing = true;
      api.state.account.analytics = false;
    });
  };
  const open = async (url = '/account/privacy') => {
    fake = await openApp(url, { routes: inertTabs, seed: (api) => seeds.forEach((seed) => seed(api)) });
  };
  const turnMarketingOff = async () => {
    await open();
    await fireEvent(await marketing(), 'valueChange', false);
  };

  test('Privacy choices show what I chose', ({ given, when, then }) => {
    given('I agreed to product news and refused usage analytics', agreedToNews);
    when('I open Privacy choices', () => open());
    then('marketing is on and analytics is off', async () => {
      expect(await marketing()).toHaveProp('value', true);
      expect(await analytics()).toHaveProp('value', false);
    });
  });

  test('Turning marketing off is recorded as made in settings', ({ given, when, then, and }) => {
    given('I agreed to product news and refused usage analytics', agreedToNews);
    when('I open Privacy choices and turn marketing off', turnMarketingOff);
    then('the server records marketing off from settings, without touching the terms', async () => {
      await waitFor(() => expect(fake.callsTo('recordConsents')).toHaveLength(1));
      expect(fake.callsTo('recordConsents')[0].body).toEqual({ marketing: false, source: 'settings' });
      expect(fake.state.account.marketing).toBe(false);
      expect(fake.state.account.history.at(-1)).toMatchObject({ type: 'marketing', granted: false, source: 'settings' });
    });
    and('it is still off when I come back', async () => {
      await reopenApp('/account/privacy');
      await waitFor(async () => expect(await marketing()).toHaveProp('value', false));
    });
  });

  test('A choice that cannot be saved goes back', ({ given, and, when, then }) => {
    given('I agreed to product news and refused usage analytics', agreedToNews);
    and('the server cannot record consents', () => {
      seeds.push((api) => api.failNext('recordConsents', 503, 'unavailable'));
    });
    when('I open Privacy choices and turn marketing off', turnMarketingOff);
    then('marketing is on again and I am told it was not saved', async () => {
      expect(await screen.findByText(en.privacy.saveFailed)).toBeTruthy();
      await waitFor(async () => expect(await marketing()).toHaveProp('value', true));
      expect(fake.state.account.marketing).toBe(true);
    });
  });

  test('Privacy choices are reachable from the account', ({ given, when, then }) => {
    given('I am on the account tab', () => {});
    when('I open Privacy choices from the list', async () => {
      await open('/account');
      await fireEvent.press(await screen.findByRole('button', { name: en.account.privacyChoices }));
    });
    then('I see the Privacy choices screen', async () => {
      expect(await marketing()).toBeTruthy();
      expect(screen).toHavePathname('/account/privacy');
    });
  });
});
