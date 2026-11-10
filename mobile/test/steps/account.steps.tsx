import { cleanup, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { openApp } from '../harness';

/* Jest has no embedded app config, so the version the screen reads is given here. */
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return { __esModule: true, ...actual, default: Object.create(actual.default, { expoConfig: { value: { version: '9.9.9' } } }) };
});

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/account.feature', { loadRelativePath: true });

/* These scenarios are about Account: inert neighbours keep the Garage's and Scans' requests out. */
const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };

defineFeature(feature, (test) => {
  test('Account details', ({ when, then }) => {
    when('I open Account', async () => {
      await openApp('/account', { as: { id: 'owner', email: 'owner@example.com' }, routes: inertTabs });
    });
    then('I see my email, the app version and the 3D model credit', async () => {
      expect(await screen.findByText('owner@example.com')).toBeTruthy();
      expect(screen.getByText('9.9.9')).toBeTruthy();
      expect(screen.getByText(en.account.modelCredit)).toBeTruthy();
    });
  });

  test('Appearance is remembered', ({ when, then }) => {
    when(/^I choose "(.*)" and restart the app$/, async (label: string) => {
      await openApp('/account', { routes: inertTabs });
      await fireEvent.press(await screen.findByRole('radio', { name: label }));
      await waitFor(() => expect(screen.getByRole('radio', { name: label })).toBeSelected());
      await cleanup();
      await openApp('/account', { routes: inertTabs });
    });
    then(/^"(.*)" is selected$/, async (label: string) => {
      await waitFor(() => expect(screen.getByRole('radio', { name: label })).toBeSelected());
      expect(screen.getByRole('radio', { name: en.account.system })).not.toBeSelected();
    });
  });

  test('Signing out', ({ when, then }) => {
    when('I choose Sign out', async () => {
      await openApp('/account', { routes: inertTabs });
      await fireEvent.press(await screen.findByRole('button', { name: en.account.signOut }));
    });
    then('I am returned to sign-in', async () => {
      await waitFor(() => expect(screen).toHavePathname('/sign-in'));
      expect(fakeAuth.signOutCalls).toBe(1);
    });
  });
});
