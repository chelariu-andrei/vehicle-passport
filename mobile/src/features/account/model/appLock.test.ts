import * as SecureStore from 'expo-secure-store';

import { appLock, reloadAppLockForTests, shouldLock } from './appLock';

const MINUTE = 60_000;

test('shouldLockAfterTimeout', () => {
  expect(shouldLock(0, MINUTE, '1m')).toBe(true);
  expect(shouldLock(0, 5 * MINUTE, '5m')).toBe(true);
  expect(shouldLock(1000, 1001, 'immediately')).toBe(true);
  expect(shouldLock(0, 10 * MINUTE, '1m')).toBe(true);
});

test('shouldNotLockWithinTimeout', () => {
  expect(shouldLock(0, MINUTE - 1, '1m')).toBe(false);
  expect(shouldLock(0, 5 * MINUTE - 1, '5m')).toBe(false);
  // Never left the app: nothing to lock.
  expect(shouldLock(null, 10 * MINUTE, 'immediately')).toBe(false);
});

test('the lock settings are kept in secure storage and read back, and a cold start with the lock on starts locked', async () => {
  await appLock.update({ enabled: true, timeout: '5m' });
  expect(SecureStore.setItemAsync).toHaveBeenCalled();
  await reloadAppLockForTests();
  expect(appLock.get()).toMatchObject({ enabled: true, timeout: '5m', walletLocked: false, loaded: true, locked: true });
});

test('a cold start with the lock off starts unlocked', async () => {
  await reloadAppLockForTests();
  expect(appLock.get()).toMatchObject({ enabled: false, locked: false });
});
