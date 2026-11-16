/* The lock sits above sheets and modals, and only ever covers a signed-in person who has it switched on. */
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState } from 'react-native';

import { appLock, reloadAppLockForTests } from '@/features/account/model/appLock';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from './fakes/auth';
import { openApp } from './harness';

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;

type Handler = (state: string) => void;
const handlers: Handler[] = [];
let spy: jest.SpyInstance;

beforeEach(() => {
  handlers.length = 0;
  spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, handler: Handler) => {
    if (type === 'change') handlers.push(handler);
    return { remove: () => { const at = handlers.indexOf(handler); if (at >= 0) handlers.splice(at, 1); } };
  }) as never);
});
afterEach(() => {
  spy.mockRestore();
  authenticate.mockImplementation(async () => ({ success: true }));
});

const send = (state: string) => act(() => handlers.forEach((handler) => handler(state)));
async function leaveAndReturn(seconds: number) {
  await send('background');
  jest.setSystemTime(Date.now() + seconds * 1000);
  await send('active');
}

test('a lock that comes up over an open sheet is in a Modal of its own, and the sheet cannot be reached', async () => {
  await appLock.update({ enabled: true, timeout: '1m' });
  await openApp('/account/security', { routes: inertTabs });
  await fireEvent.press(await screen.findByRole('button', { name: en.security.signOutOthers }));
  await screen.findByText(en.security.confirmTitle);

  authenticate.mockResolvedValue({ success: false });
  await leaveAndReturn(120);
  const unlock = await screen.findByRole('button', { name: en.appLock.unlock });

  let lockModal = unlock.parent;
  while (lockModal && lockModal.type !== 'Modal') lockModal = lockModal.parent;
  expect(lockModal).not.toBeNull();
  expect(lockModal!.props.visible).toBe(true);
  expect(unlock).toBeTruthy();
  expect(screen.queryByRole('button', { name: en.security.confirm })).toBeNull();
});

test('coming back while signed out does not leave a lock waiting for the next sign-in', async () => {
  await appLock.update({ enabled: true, timeout: '1m' });
  await openApp('/sign-in', { as: null });
  await screen.findByText(en.auth.signInTitle);
  await leaveAndReturn(120);
  await act(async () => fakeAuth.signInAs('user-1', 'owner@example.com'));
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.queryByRole('button', { name: en.appLock.unlock })).toBeNull();
});

test('a cold start while signed out does not lock the next sign-in', async () => {
  await appLock.update({ enabled: true });
  await openApp('/sign-in', { as: null });
  await screen.findByText(en.auth.signInTitle);
  await act(async () => reloadAppLockForTests());
  await act(async () => fakeAuth.signInAs('user-1', 'owner@example.com'));
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.queryByRole('button', { name: en.appLock.unlock })).toBeNull();
});

test('switching the lock on after being away past the timeout does not lock at once', async () => {
  await openApp('/account', { routes: inertTabs });
  await screen.findByRole('button', { name: en.account.security });
  await leaveAndReturn(120);
  await act(async () => appLock.update({ enabled: true, timeout: '1m' }));
  expect(screen.queryByRole('button', { name: en.appLock.unlock })).toBeNull();
  await send('active');
  expect(screen.queryByRole('button', { name: en.appLock.unlock })).toBeNull();
});

test('the lock screen has a way out: Sign out ends the session and the lock closes', async () => {
  await appLock.update({ enabled: true, timeout: '1m' });
  await openApp('/account', { routes: inertTabs });
  await screen.findByRole('button', { name: en.account.security });
  authenticate.mockResolvedValue({ success: false });
  await leaveAndReturn(120);
  await fireEvent.press(await screen.findByRole('button', { name: en.appLock.signOut }));
  await waitFor(() => expect(screen).toHavePathname('/sign-in'));
  expect(fakeAuth.signOutCalls).toBe(1);
  expect(screen.queryByRole('button', { name: en.appLock.unlock })).toBeNull();
  expect(appLock.get().locked).toBe(false);
});
