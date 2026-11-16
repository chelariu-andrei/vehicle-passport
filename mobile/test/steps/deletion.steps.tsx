import { File } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { appLock } from '@/features/account/model/appLock';
import { signOut } from '@/shared/auth/session';
import { en } from '@/shared/i18n/en';

import { PASSWORD } from '../fakes/auth';
import type { FakeApi } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/deletion.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const files = File as unknown as { written: { uri: string; data: unknown }[]; deleted: string[] };
const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const isAvailable = Sharing.isAvailableAsync as jest.Mock;
const share = Sharing.shareAsync as jest.Mock;
const DAY = 86_400_000;

/** The date the way a person reads it (day, month, year), from an ISO instant. */
const readable = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
/** The tab bar is native: the dot is the badge value the Account tab hands to it, found in the rendered tree. */
function badgeValues(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((child) => badgeValues(child, found));
  else if (node && typeof node === 'object') {
    const { props, children } = node as { props?: { badgeValue?: unknown }; children?: unknown };
    if (typeof props?.badgeValue === 'string' && props.badgeValue !== '') found.push(props.badgeValue);
    badgeValues(children, found);
  }
  return found;
}
const deleteButton = () => screen.getByRole('button', { name: en.deletion.action });

beforeEach(() => {
  files.written.length = 0;
  files.deleted.length = 0;
  share.mockClear();
  authenticate.mockClear();
});
afterEach(() => {
  isAvailable.mockImplementation(async () => true);
  authenticate.mockImplementation(async () => ({ success: true }));
});

defineFeature(feature, (test) => {
  let fake: FakeApi;

  /** Reached the way a person gets there: from the Account tab, which stays mounted beneath it (so does the tab bar and its dot). */
  const onDeleteScreen = async () => {
    fake = await openApp('/account', { routes: inertTabs });
    await fireEvent.press(await screen.findByRole('button', { name: en.account.deleteAccount }));
    await screen.findByText(en.deletion.deletedTitle);
  };
  const givenDeleteScreen = (given: (text: string, fn: () => Promise<void>) => void) =>
    given('I am on the delete account screen', () => onDeleteScreen());
  const tick = () => fireEvent.press(screen.getByRole('checkbox', { name: en.deletion.understand }));
  const confirm = async () => {
    await fireEvent.press(deleteButton());
    await fireEvent.press(await screen.findByRole('button', { name: en.deletion.sheetConfirm }));
  };
  const seeScheduled = async () => {
    // The banner is on the delete screen and on the Account tab beneath it.
    expect((await screen.findAllByText(en.deletion.scheduledTitle)).length).toBeGreaterThan(0);
    const date = fake.state.account.deletion!;
    expect(Math.round((Date.parse(date) - Date.now()) / DAY)).toBe(30);
    expect(screen.getAllByText(en.deletion.scheduledBody(readable(date))).length).toBeGreaterThan(0);
  };
  const seeDot = (shown: boolean) => async () => {
    await waitFor(() => expect(badgeValues(screen.toJSON()).length > 0).toBe(shown));
  };
  const scheduledOnAccount = async () => {
    fake = await openApp('/account', {
      routes: inertTabs,
      seed: (api) => {
        api.state.account.deletion = new Date(Date.now() + 12 * DAY).toISOString();
      },
    });
    expect(await screen.findByText(en.deletion.scheduledTitle)).toBeTruthy();
  };

  test('Delete button disabled until the box is ticked', ({ given, when, then }) => {
    givenDeleteScreen(given);
    then('Delete my account is disabled', () => {
      expect(deleteButton()).toBeDisabled();
    });
    when('I tick I understand', tick);
    then('Delete my account is enabled', () => {
      expect(deleteButton()).toBeEnabled();
    });
  });

  test('Scheduling shows the date 30 days out and a dot on the tab', ({ given, when, then, and }) => {
    givenDeleteScreen(given);
    when('I tick I understand and confirm the deletion', async () => {
      await tick();
      await confirm();
    });
    then('I see Deletion scheduled with the date 30 days out', seeScheduled);
    and('the Account tab shows a dot', seeDot(true));
    and('I am still signed in', () => {
      expect(screen).toHavePathname('/account/delete');
      expect(fake.callsTo('scheduleDeletion')).toHaveLength(1);
    });
  });

  test('Cancel clears the banner and the dot', ({ given, when, then, and }) => {
    given('my deletion is already scheduled and I am on Account', scheduledOnAccount);
    when('I cancel the deletion', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.deletion.cancel }));
    });
    then('the banner is gone', async () => {
      await waitFor(() => expect(screen.queryByText(en.deletion.scheduledTitle)).toBeNull());
      expect(fake.state.account.deletion).toBeNull();
    });
    and('the Account tab shows no dot', seeDot(false));
  });

  test('Scheduling twice shows the existing date', ({ given, and, when, then }) => {
    givenDeleteScreen(given);
    and('the account already has a deletion scheduled elsewhere', () => {
      // The app has not been told yet: the server already holds a date.
      fake.state.account.deletion = new Date(Date.now() + 30 * DAY).toISOString();
    });
    when('I tick I understand and confirm the deletion', async () => {
      await tick();
      await confirm();
    });
    then('I see Deletion scheduled with the date 30 days out', async () => {
      await seeScheduled();
      expect(fake.callsTo('scheduleDeletion')).toHaveLength(1);
    });
  });

  test('Export shares a JSON file', ({ given, when, then }) => {
    givenDeleteScreen(given);
    when('I download my data', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.deletion.download }));
    });
    then('a JSON file with my data is saved in the cache and shared', async () => {
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
      expect(files.written).toHaveLength(1);
      expect(files.written[0].uri).toBe('cache/vehicle-passport-data.json');
      const data = JSON.parse(files.written[0].data as string) as { profile: { email: string }; exportedAt: string };
      expect(data.profile.email).toBe('me@example.com');
      expect(typeof data.exportedAt).toBe('string');
      expect(share).toHaveBeenCalledWith('cache/vehicle-passport-data.json', expect.objectContaining({ mimeType: 'application/json' }));
    });
  });

  test('Export failure shows a toast', ({ given, and, when, then }) => {
    givenDeleteScreen(given);
    and('the export will fail', () => {
      fake.failNext('exportMyData', 500, 'internal-error');
    });
    when('I download my data', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.deletion.download }));
    });
    then('I see the export failed', async () => {
      expect(await screen.findByText(en.export.failed)).toBeTruthy();
      expect(share).not.toHaveBeenCalled();
    });
    and('no file is left behind', () => {
      expect(files.written).toHaveLength(0);
    });
  });

  test('Export is explained when sharing is unavailable', ({ given, and, when, then }) => {
    givenDeleteScreen(given);
    and('sharing is unavailable on this device', () => {
      isAvailable.mockImplementation(async () => false);
    });
    when('I download my data', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.deletion.download }));
    });
    then('I see sharing is unavailable', async () => {
      expect(await screen.findByText(en.export.unavailable)).toBeTruthy();
      expect(share).not.toHaveBeenCalled();
    });
    and('no file was written', () => {
      expect(files.written).toHaveLength(0);
    });
  });

  test('Banner persists after sign-out and sign-in', ({ given, when, then, and }) => {
    given('my deletion is already scheduled and I am on Account', scheduledOnAccount);
    when('I sign out and sign in again', async () => {
      await act(async () => {
        await signOut();
      });
      await waitFor(() => expect(screen).toHavePathname('/sign-in'));
      await fireEvent.changeText(screen.getByLabelText(en.auth.email), 'owner@example.com');
      await fireEvent.changeText(screen.getByLabelText(en.auth.password), PASSWORD);
      await fireEvent.press(screen.getByRole('button', { name: en.auth.signInAction }));
      await waitFor(() => expect(screen).not.toHavePathname('/sign-in'));
      await act(async () => router.navigate('/account'));
    });
    then('the banner is shown on Account', async () => {
      expect(await screen.findByText(en.deletion.scheduledTitle)).toBeTruthy();
      expect(fake.callsTo('getMe').length).toBeGreaterThan(1);
    });
    and('the Account tab shows a dot', seeDot(true));
  });

  test('Lock enabled requires biometrics before scheduling', ({ given, when, then }) => {
    given('the app lock is on and I am on the delete account screen', async () => {
      await appLock.update({ enabled: true, timeout: '1m' });
      await onDeleteScreen();
    });
    when('I tick I understand and confirm the deletion with biometrics failing', async () => {
      authenticate.mockImplementation(async () => ({ success: false }));
      await tick();
      await confirm();
    });
    then('nothing was scheduled', async () => {
      await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
      expect(fake.callsTo('scheduleDeletion')).toHaveLength(0);
      expect(fake.state.account.deletion).toBeNull();
    });
    when('I confirm the deletion with biometrics succeeding', async () => {
      authenticate.mockImplementation(async () => ({ success: true }));
      await confirm();
    });
    then('I see Deletion scheduled with the date 30 days out', async () => {
      await seeScheduled();
      expect(authenticate).toHaveBeenCalledTimes(2);
    });
  });
});
