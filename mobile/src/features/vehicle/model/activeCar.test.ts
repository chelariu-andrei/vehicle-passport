import AsyncStorage from '@react-native-async-storage/async-storage';

import { activeCarStore, pickActive } from './activeCar';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('pickActive', () => {
  test('nothing to pick from', () => {
    expect(pickActive([], 'A')).toBeNull();
  });
  test('falls to the first car without a stored choice', () => {
    expect(pickActive([{ vin: 'A' }, { vin: 'B' }], null)).toBe('A');
  });
  test('keeps the stored car when it is in the list', () => {
    expect(pickActive([{ vin: 'A' }, { vin: 'B' }], 'B')).toBe('B');
  });
  test('moves on when the stored car is gone', () => {
    expect(pickActive([{ vin: 'A' }], 'GONE')).toBe('A');
  });
});

describe('activeCarStore', () => {
  test('reads null before anything is stored', async () => {
    expect(await activeCarStore.get('u1')).toBeNull();
  });
  test('keeps one choice per user', async () => {
    await activeCarStore.set('u1', 'A');
    await activeCarStore.set('u2', 'B');
    expect(await activeCarStore.get('u1')).toBe('A');
    expect(await activeCarStore.get('u2')).toBe('B');
  });
  test('survives a storage failure', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    expect(await activeCarStore.get('u1')).toBeNull();
    spy.mockRestore();
  });
});
