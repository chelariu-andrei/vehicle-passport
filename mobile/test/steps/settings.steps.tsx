import { cleanup, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';
import { ro } from '@/shared/i18n/ro';

import type { FakeApi } from '../fake-api';
import { openApp, reopenApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/settings.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const owner = { id: 'owner', email: 'owner@example.com' };

defineFeature(feature, (test) => {
  let fake: FakeApi;
  const open = async (url: string, seed?: (api: FakeApi) => void) => {
    fake = await openApp(url, {
      as: owner,
      routes: inertTabs,
      seed: (api) => {
        api.state.account.email = owner.email;
        seed?.(api);
      },
    });
  };
  const reminder = (days: 30 | 7 | 1) => screen.findByRole('checkbox', { name: en.settings.notifications.reminder[days] });
  const scansSwitch = () => screen.findByRole('switch', { name: en.settings.notifications.activityScans });
  const openNotifications = async () => {
    await open('/account/notifications');
    await scansSwitch();
  };

  test('Switching to Română re-renders the Account tab at once', ({ given, when, then }) => {
    given('I am on the Account tab in English', async () => {
      await open('/account');
      await screen.findByRole('button', { name: en.account.language });
    });
    when('I choose Română on the Language screen and go back', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.account.language }));
      await fireEvent.press(await screen.findByRole('radio', { name: en.settings.language.ro }));
      await waitFor(() => expect(fake.state.account.settings.language).toBe('ro'));
      await fireEvent.press(screen.getByRole('button', { name: en.common.back }));
    });
    then('the Account tab is in Romanian', async () => {
      expect(await screen.findByRole('button', { name: ro.account!.signOut! })).toBeTruthy();
      expect(screen.getByText(ro.account!.groups!.preferences!)).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.account.signOut })).toBeNull();
    });
  });

  test('Toggling a notification persists', ({ when, and, then }) => {
    when('I switch off activity from scans on the Notifications screen', async () => {
      await openNotifications();
      await fireEvent(await scansSwitch(), 'valueChange', false);
      await waitFor(() => expect(fake.state.account.settings.notifications.activityScans).toBe(false));
    });
    and('I open the Notifications screen again after a reload', async () => {
      await cleanup();
      await reopenApp('/account/notifications');
    });
    then('activity from scans is off', async () => {
      await scansSwitch();
      await waitFor(() => expect(screen.getByRole('switch', { name: en.settings.notifications.activityScans })).toHaveProp('value', false));
    });
  });

  test('Reminder chips 30/7/1 toggle individually', ({ when, then }) => {
    when('I turn off the 7 day reminder', async () => {
      await openNotifications();
      await fireEvent.press(await reminder(7));
      await waitFor(() => expect(fake.state.account.settings.notifications.reminderDays).toEqual([30, 1]));
    });
    then('only the 30 day and 1 day reminders are on', async () => {
      const chip = (days: 30 | 7 | 1) => screen.getByRole('checkbox', { name: en.settings.notifications.reminder[days] });
      await waitFor(() => expect(chip(7)).not.toBeChecked());
      expect(chip(30)).toBeChecked();
      expect(chip(1)).toBeChecked();
    });
  });

  test('Product news is off by default', ({ when, then }) => {
    when('I open the Notifications screen', async () => {
      await openNotifications();
    });
    then('product news is off', async () => {
      expect(await screen.findByRole('switch', { name: en.settings.notifications.productNews })).toHaveProp('value', false);
    });
  });

  test('Failed save reverts the switch and shows a toast', ({ given, when, then }) => {
    given('the server will reject the next settings save', async () => {
      await openNotifications();
      fake.failNext('updateSettings', 500, null);
    });
    when('I switch off activity from scans on the Notifications screen', async () => {
      await fireEvent(await scansSwitch(), 'valueChange', false);
    });
    then('activity from scans is on again and I see the save failed message', async () => {
      expect(await screen.findByText(en.settings.saveFailed)).toBeTruthy();
      await waitFor(() => expect(screen.getByRole('switch', { name: en.settings.notifications.activityScans })).toHaveProp('value', true));
      expect(fake.state.account.settings.notifications.activityScans).toBe(true);
    });
  });

  test('Units and currency persist', ({ when, and, then }) => {
    when('I choose miles and euro on the Units screen', async () => {
      await open('/account/units');
      await fireEvent.press(await screen.findByRole('radio', { name: en.settings.units.mi }));
      await fireEvent.press(screen.getByRole('radio', { name: en.settings.units.EUR }));
      await waitFor(() => expect(fake.state.account.settings.units).toEqual({ distance: 'mi', currency: 'EUR' }));
    });
    and('I open the Units screen again after a reload', async () => {
      await cleanup();
      await reopenApp('/account/units');
    });
    then('miles and euro are selected', async () => {
      await screen.findByRole('radio', { name: en.settings.units.mi });
      await waitFor(() => expect(screen.getByRole('radio', { name: en.settings.units.mi })).toBeSelected());
      expect(screen.getByRole('radio', { name: en.settings.units.EUR })).toBeSelected();
      expect(screen.getByRole('radio', { name: en.settings.units.km })).not.toBeSelected();
    });
  });

  test('Appearance is remembered', ({ when, then }) => {
    when(/^I choose "(.*)" on the Appearance screen and restart the app$/, async (label: string) => {
      await open('/account/appearance');
      await fireEvent.press(await screen.findByRole('radio', { name: label }));
      await waitFor(() => expect(screen.getByRole('radio', { name: label })).toBeSelected());
      await cleanup();
      await openApp('/account/appearance', { routes: inertTabs });
    });
    then(/^"(.*)" is selected on the Appearance screen$/, async (label: string) => {
      await waitFor(() => expect(screen.getByRole('radio', { name: label })).toBeSelected());
      expect(screen.getByRole('radio', { name: en.account.system })).not.toBeSelected();
    });
  });
});
