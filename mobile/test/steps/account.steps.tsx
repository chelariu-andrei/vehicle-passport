import { cleanup, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { aPassport, aVehicle } from '../fake-api';
import type { FakeApi } from '../fake-api';
import { openApp, reopenApp } from '../harness';

/* Jest has no embedded app config, so the version the screen reads is given here. */
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return { __esModule: true, ...actual, default: Object.create(actual.default, { expoConfig: { value: { version: '9.9.9' } } }) };
});

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/account.feature', { loadRelativePath: true });

/* These scenarios are about Account: inert neighbours keep the Garage's and Scans' requests out. */
const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const owner = { id: 'owner', email: 'owner@example.com' };

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let seeds: ((api: FakeApi) => void)[] = [];
  beforeEach(() => {
    seeds = [];
  });
  const seed = (fn: (api: FakeApi) => void) => seeds.push(fn);
  const open = async (url: string) => {
    fake = await openApp(url, {
      as: owner,
      routes: inertTabs,
      seed: (api) => {
        api.state.account.displayName = 'Ana Pop';
        api.state.account.email = owner.email;
        seeds.forEach((fn) => fn(api));
      },
    });
  };
  const openProfile = async () => {
    await open('/account/profile');
    await screen.findByDisplayValue('Ana Pop');
  };
  const nameField = () => screen.getByLabelText(en.profile.name);
  const phoneField = () => screen.getByLabelText(en.profile.phone);
  const save = () => fireEvent.press(screen.getByRole('button', { name: en.profile.save }));
  const changeName = async (value: string) => {
    await openProfile();
    await fireEvent.changeText(nameField(), value);
    await save();
  };
  const sentBody = () => fake.callsTo('updateProfile')[0]?.body;

  test('Account details', ({ when, then }) => {
    when('I open Account', async () => {
      await open('/account');
    });
    then('I see my email and the app version', async () => {
      expect(await screen.findByText('owner@example.com')).toBeTruthy();
      expect(screen.getByText(/9\.9\.9/)).toBeTruthy();
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
      // Let the account finish loading, so no request is still in flight when the session ends.
      await screen.findByText(en.account.stats.vehicles(0));
      await fireEvent.press(await screen.findByRole('button', { name: en.account.signOut }));
    });
    then('I am returned to sign-in', async () => {
      await waitFor(() => expect(screen).toHavePathname('/sign-in'));
      expect(fakeAuth.signOutCalls).toBe(1);
    });
  });

  test('Profile card shows name, email and counts', ({ given, when, then }) => {
    given(/^my profile has the name "(.*)" and one car and one passport$/, (name: string) => {
      seed((api) => {
        api.state.account.displayName = name;
        api.state.vehicles.push(aVehicle());
        api.state.passports.push(aPassport());
      });
    });
    when('I open Account', async () => {
      await open('/account');
    });
    then(/^I see "(.*)", my email and the counts 1 car, 0 entries and 1 passport$/, async (name: string) => {
      expect(await screen.findByText(name)).toBeTruthy();
      expect(screen.getByText('owner@example.com')).toBeTruthy();
      expect(screen.getByText(en.account.stats.vehicles(1))).toBeTruthy();
      expect(screen.getByText(en.account.stats.events(0))).toBeTruthy();
      expect(screen.getByText(en.account.stats.passports(1))).toBeTruthy();
    });
  });

  test('Edit name persists after reload', ({ when, and, then }) => {
    when(/^I change my name to "(.*)" on Profile and save$/, async (name: string) => {
      await changeName(name);
      await waitFor(() => expect(fake.state.account.displayName).toBe(name));
    });
    and('I open Profile again after a reload', async () => {
      await cleanup();
      await reopenApp('/account/profile');
    });
    then(/^the name field shows "(.*)"$/, async (name: string) => {
      expect(await screen.findByDisplayValue(name)).toBeTruthy();
    });
  });

  test('Phone with spaces is normalised and saved', ({ when, then }) => {
    when(/^I save the phone "(.*)" on Profile$/, async (phone: string) => {
      await openProfile();
      await fireEvent.changeText(phoneField(), phone);
      await save();
    });
    then(/^the phone is sent as "(.*)"$/, async (phone: string) => {
      await waitFor(() => expect(sentBody()).toEqual({ phone }));
      expect(fake.state.account.phone).toBe(phone);
    });
  });

  test('Invalid phone shows a field error', ({ when, then }) => {
    when(/^I save the phone "(.*)" on Profile$/, async (phone: string) => {
      await openProfile();
      await fireEvent.changeText(phoneField(), phone);
      await save();
    });
    then('I see the phone format error and nothing is sent', async () => {
      expect(await screen.findByText(en.validation.phoneInvalid)).toBeTruthy();
      expect(fake.callsTo('updateProfile')).toHaveLength(0);
    });
  });

  test('Clearing phone sends null', ({ given, when, then }) => {
    given(/^my profile has the phone "(.*)"$/, (phone: string) => {
      seed((api) => {
        api.state.account.phone = phone;
      });
    });
    when('I clear the phone on Profile and save', async () => {
      await openProfile();
      await fireEvent.changeText(phoneField(), '');
      await save();
    });
    then('the phone is sent as null', async () => {
      await waitFor(() => expect(sentBody()).toEqual({ phone: null }));
      expect(fake.state.account.phone).toBeNull();
    });
  });

  test('Server validation error is shown under the field', ({ given, when, then, and }) => {
    given('the server will reject the next profile update', () => {
      seed((api) => api.failNext('updateProfile', 400, 'validation-failed'));
    });
    when(/^I change my name to "(.*)" on Profile and save$/, async (name: string) => {
      await changeName(name);
    });
    then('I see the server message under the name field', async () => {
      expect(await screen.findByText(en.errors.codes['validation-failed'])).toBeTruthy();
    });
    and(/^the name field still shows "(.*)"$/, (name: string) => {
      expect(nameField().props.value).toBe(name);
      expect(fake.state.account.displayName).toBe('Ana Pop');
    });
  });

  test('Sign out is separate from delete', ({ when, then }) => {
    when('I open Account', async () => {
      await open('/account');
    });
    then('Sign out and Delete account are different rows in different groups', async () => {
      const signOutGroup = await screen.findByTestId('group-sign-out');
      const deleteGroup = screen.getByTestId('group-delete');
      expect(within(signOutGroup).getByRole('button', { name: en.account.signOut })).toBeTruthy();
      expect(within(signOutGroup).queryByRole('button', { name: en.account.deleteAccount })).toBeNull();
      expect(within(deleteGroup).getByRole('button', { name: en.account.deleteAccount })).toBeTruthy();
    });
  });
});
