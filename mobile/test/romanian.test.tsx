/* With the app in Romanian, the auth and legal screens speak Romanian (English is the default, covered by the other suites). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from 'expo-router/testing-library';

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
