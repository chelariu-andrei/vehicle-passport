import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { LargeSecureStore } from './largeSecureStore';

const KEY = 'sb-session';
const value = JSON.stringify({ access_token: 'x'.repeat(5000), user: { email: 'owner@example.com' } });

beforeEach(async () => {
  await AsyncStorage.clear();
  await SecureStore.deleteItemAsync(KEY);
});

test('a 5 KB value round-trips', async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, value);
  expect(value.length).toBeGreaterThan(5000);
  expect(await store.getItem(KEY)).toBe(value);
});

test('what AsyncStorage holds is not the plaintext', async () => {
  await new LargeSecureStore().setItem(KEY, value);
  const stored = await AsyncStorage.getItem(KEY);
  expect(stored).not.toBeNull();
  expect(stored).not.toContain('owner@example.com');
  expect(stored).not.toContain('xxxxxxxx');
});

test('the encryption key lives in SecureStore, and is 32 bytes', async () => {
  await new LargeSecureStore().setItem(KEY, value);
  const key = await SecureStore.getItemAsync(KEY);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
});

test('a second instance reads what the first wrote', async () => {
  await new LargeSecureStore().setItem(KEY, value);
  expect(await new LargeSecureStore().getItem(KEY)).toBe(value);
});

test('removeItem clears both stores', async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, value);
  await store.removeItem(KEY);
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
  expect(await SecureStore.getItemAsync(KEY)).toBeNull();
  expect(await store.getItem(KEY)).toBeNull();
});

test('a value whose key is gone reads as absent rather than throwing', async () => {
  const store = new LargeSecureStore();
  await store.setItem(KEY, value);
  await SecureStore.deleteItemAsync(KEY);
  expect(await store.getItem(KEY)).toBeNull();
});
