/* With the app in Romanian, the auth and legal screens speak Romanian (English is the default, covered by the other suites). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import * as LocalAuthentication from 'expo-local-authentication';

import { appLock } from '@/features/account/model/appLock';
import { ro } from '@/shared/i18n/ro';

import { openApp } from './harness';

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };

beforeEach(async () => {
  await AsyncStorage.setItem('language', 'ro');
});

test('sign-in is in Romanian, its validation and server errors too', async () => {
  await openApp('/sign-in', { as: null });
  expect(await screen.findByText(ro.auth!.signInTitle!)).toBeTruthy();
  expect(screen.getByRole('button', { name: ro.auth!.toSignUp! })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText(ro.auth!.email!), 'not-an-email');
  await fireEvent.changeText(screen.getByLabelText(ro.auth!.password!), 'secret');
  await fireEvent.press(screen.getByRole('button', { name: ro.auth!.signInAction! }));
  expect(await screen.findByText(ro.validation!.emailInvalid!)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText(ro.auth!.email!), 'owner@example.com');
  await fireEvent.changeText(screen.getByLabelText(ro.auth!.password!), 'not-the-password');
  await fireEvent.press(screen.getByRole('button', { name: ro.auth!.signInAction! }));
  expect(await screen.findByText(ro.auth!.invalidCredentials!)).toBeTruthy();
});

test('sign-up and the password reset screens are in Romanian', async () => {
  await openApp('/sign-up', { as: null });
  expect(await screen.findByText(ro.auth!.signUpTitle!)).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: `${ro.auth!.termsLabel} ${ro.auth!.terms} ${ro.auth!.and} ${ro.auth!.privacy}` })).toBeTruthy();
});

test('forgot password is in Romanian', async () => {
  await openApp('/forgot-password', { as: null });
  expect(await screen.findByText(ro.auth!.forgotTitle!)).toBeTruthy();
});

test('the legal list shows the Romanian version line', async () => {
  await openApp('/account/legal', { routes: inertTabs });
  expect((await screen.findAllByText(/^Versiunea 1\.0 · în vigoare din /)).length).toBe(3);
});

test('sign-in methods and security are in Romanian', async () => {
  await openApp('/account/sign-in-methods', { routes: inertTabs });
  expect(await screen.findByText(ro.signInMethods!.intro!)).toBeTruthy();
  expect(screen.getByRole('button', { name: ro.signInMethods!.disconnectLabel!(ro.signInMethods!.email!) })).toBeTruthy();
  expect(screen.getByText(ro.signInMethods!.changePassword!, { exact: true })).toBeTruthy();
});

test('the security screen is in Romanian', async () => {
  await openApp('/account/security', { routes: inertTabs });
  expect(await screen.findByRole('button', { name: ro.security!.signOutOthers! })).toBeTruthy();
  expect(screen.getByRole('switch', { name: ro.security!.biometrics! })).toBeTruthy();
});

test('support and acknowledgements are in Romanian', async () => {
  await openApp('/account/support', { routes: inertTabs });
  expect(await screen.findByText(ro.support!.intro!)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText(ro.support!.message!), 'scurt');
  await fireEvent.press(screen.getByRole('button', { name: ro.support!.send! }));
  expect(await screen.findByText(ro.validation!.supportMessageTooShort!)).toBeTruthy();
  expect(screen.getByRole('switch', { name: ro.support!.diagnostics! })).toBeTruthy();
});

test('the acknowledgements are in Romanian', async () => {
  await openApp('/account/acknowledgements', { routes: inertTabs });
  expect(await screen.findByText(ro.acknowledgements!.intro!)).toBeTruthy();
});

test('the delete account screen and the export are in Romanian', async () => {
  await openApp('/account/delete', { routes: inertTabs });
  expect(await screen.findByText(ro.deletion!.deletedTitle!)).toBeTruthy();
  expect(screen.getByText(ro.deletion!.staysTitle!)).toBeTruthy();
  expect(screen.getByRole('button', { name: ro.deletion!.download! })).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox', { name: ro.deletion!.understand! }));
  await fireEvent.press(screen.getByRole('button', { name: ro.deletion!.action! }));
  await fireEvent.press(await screen.findByRole('button', { name: ro.deletion!.sheetConfirm! }));
  expect(await screen.findByText(ro.deletion!.scheduledTitle!)).toBeTruthy();
  expect(screen.getByRole('button', { name: ro.deletion!.cancel! })).toBeTruthy();
});

test('the consent retry screen is in Romanian', async () => {
  await openApp('/', {
    routes: inertTabs,
    seed: (api) => {
      api.failNext('getMe', 503, 'unavailable');
    },
  });
  expect(await screen.findByText(ro.consent!.retryTitle!)).toBeTruthy();
  expect(screen.getAllByRole('button', { name: ro.consent!.signOut! }).length).toBeGreaterThan(0);
});

test('the lock screen is in Romanian, with its way out', async () => {
  const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;
  authenticate.mockResolvedValue({ success: false });
  await appLock.update({ enabled: true });
  await openApp('/', { routes: inertTabs });
  await act(async () => appLock.setLocked(true));
  expect(await screen.findByText(ro.appLock!.title!)).toBeTruthy();
  expect(screen.getByRole('button', { name: ro.appLock!.signOut! })).toBeTruthy();
  authenticate.mockImplementation(async () => ({ success: true }));
});

test('the privacy choices are in Romanian', async () => {
  await openApp('/account/privacy', { routes: inertTabs });
  expect(await screen.findByText(ro.privacy!.intro!)).toBeTruthy();
  expect(screen.getByRole('switch', { name: ro.privacy!.marketing! })).toBeTruthy();
  expect(screen.getByRole('switch', { name: ro.privacy!.analytics! })).toBeTruthy();
});
