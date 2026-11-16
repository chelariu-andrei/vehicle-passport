/* Turning the app lock on: the phone must be able to check, and the person must pass the check first. */
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as LocalAuthentication from 'expo-local-authentication';

import { appLock } from '@/features/account/model/appLock';
import { en } from '@/shared/i18n/en';

import { openApp } from './harness';

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const hasHardware = LocalAuthentication.hasHardwareAsync as jest.Mock;
const isEnrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;

beforeEach(() => authenticate.mockClear());

afterEach(() => {
  hasHardware.mockImplementation(async () => true);
  isEnrolled.mockImplementation(async () => true);
  authenticate.mockImplementation(async () => ({ success: true }));
});

const open = async () => {
  await openApp('/account/security', { routes: inertTabs });
  return screen.findByRole('switch', { name: en.security.biometrics });
};

test('the lock turns on after a successful check and offers the timeout choice', async () => {
  await fireEvent(await open(), 'valueChange', true);
  await waitFor(() => expect(appLock.get().enabled).toBe(true));
  expect(authenticate).toHaveBeenCalled();
  await fireEvent.press(await screen.findByRole('radio', { name: en.security.timeout['5m'] }));
  await waitFor(() => expect(appLock.get().timeout).toBe('5m'));
});

test('a failed check leaves the lock off', async () => {
  authenticate.mockResolvedValue({ success: false });
  await fireEvent(await open(), 'valueChange', true);
  expect(await screen.findByText(en.security.authFailed)).toBeTruthy();
  expect(appLock.get().enabled).toBe(false);
});

test('a phone with no sensor says so and does not ask for a check', async () => {
  hasHardware.mockResolvedValue(false);
  await fireEvent(await open(), 'valueChange', true);
  expect(await screen.findByText(en.security.noHardware)).toBeTruthy();
  expect(authenticate).not.toHaveBeenCalled();
  expect(appLock.get().enabled).toBe(false);
});

test('a phone with nothing enrolled says so', async () => {
  isEnrolled.mockResolvedValue(false);
  await fireEvent(await open(), 'valueChange', true);
  expect(await screen.findByText(en.security.notEnrolled)).toBeTruthy();
  expect(appLock.get().enabled).toBe(false);
});

describe('turning the lock off', () => {
  const openOn = async () => {
    await appLock.update({ enabled: true });
    const toggle = await open();
    await waitFor(() => expect(toggle.props.value).toBe(true));
    return toggle;
  };

  test('asks for the check first and switches off when it passes', async () => {
    await fireEvent(await openOn(), 'valueChange', false);
    await waitFor(() => expect(appLock.get().enabled).toBe(false));
    expect(authenticate).toHaveBeenCalled();
  });

  test('a failed check keeps the lock on', async () => {
    authenticate.mockResolvedValue({ success: false });
    await fireEvent(await openOn(), 'valueChange', false);
    await waitFor(() => expect(authenticate).toHaveBeenCalled());
    expect(await screen.findByText(en.security.authFailedOff)).toBeTruthy();
    expect(appLock.get().enabled).toBe(true);
  });

  test('with nothing enrolled any more it can still be switched off', async () => {
    isEnrolled.mockResolvedValue(false);
    await fireEvent(await openOn(), 'valueChange', false);
    await waitFor(() => expect(appLock.get().enabled).toBe(false));
    expect(authenticate).not.toHaveBeenCalled();
  });
});
