import AsyncStorage from '@react-native-async-storage/async-storage';

import { claimStore } from './claimStore';

const claim = (claimId: string, vin = 'WVWZZZ1JZXW000001') => ({ claimId, vin, filedAt: '2025-01-15T10:00:00Z' });

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('upsert is idempotent by claimId', async () => {
  await claimStore.upsert('u1', claim('c1'));
  await claimStore.upsert('u1', claim('c1'));
  await claimStore.upsert('u1', claim('c2', 'WVWZZZ1JZXW000002'));
  expect((await claimStore.list('u1')).map((c) => c.claimId)).toEqual(['c1', 'c2']);
});

test('entries are isolated by user id', async () => {
  await claimStore.upsert('u1', claim('c1'));
  expect(await claimStore.list('u2')).toEqual([]);
  await claimStore.remove('u2', 'c1');
  expect(await claimStore.list('u1')).toHaveLength(1);
  await claimStore.remove('u1', 'c1');
  expect(await claimStore.list('u1')).toEqual([]);
});

test('dropResolved removes claims whose VIN is in the garage and returns the rest', async () => {
  await claimStore.upsert('u1', claim('c1', 'WVWZZZ1JZXW000001'));
  await claimStore.upsert('u1', claim('c2', 'WVWZZZ1JZXW000002'));
  const rest = await claimStore.dropResolved('u1', ['WVWZZZ1JZXW000001']);
  expect(rest.map((c) => c.claimId)).toEqual(['c2']);
  expect((await claimStore.list('u1')).map((c) => c.claimId)).toEqual(['c2']);
});

test('unreadable stored data counts as no claims', async () => {
  await AsyncStorage.setItem('claims:u1', '{not json');
  expect(await claimStore.list('u1')).toEqual([]);
  await AsyncStorage.setItem('claims:u1', JSON.stringify([{ claimId: 3 }, claim('c1')]));
  expect((await claimStore.list('u1')).map((c) => c.claimId)).toEqual(['c1']);
});
