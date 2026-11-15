import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_DRAFT, isBlank, journeyDraftStore } from './journeyDraft';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('isBlank', () => {
  test('an empty draft is blank', () => {
    expect(isBlank(EMPTY_DRAFT)).toBe(true);
  });
  test('any typed field makes it not blank', () => {
    expect(isBlank({ ...EMPTY_DRAFT, vin: 'W' })).toBe(false);
    expect(isBlank({ ...EMPTY_DRAFT, fuel: 'DIESEL' })).toBe(false);
  });
});

describe('journeyDraftStore', () => {
  const draft = { ...EMPTY_DRAFT, step: 'details' as const, vin: 'WVWZZZ1JZXW000001', make: 'Volkswagen', fuel: 'DIESEL' as const };

  test('reads null before anything is stored', async () => {
    expect(await journeyDraftStore.get('u1')).toBeNull();
  });
  test('keeps one draft per user and clears it', async () => {
    await journeyDraftStore.set('u1', draft);
    await journeyDraftStore.set('u2', { ...draft, make: 'Audi' });
    expect(await journeyDraftStore.get('u1')).toEqual(draft);
    expect((await journeyDraftStore.get('u2'))?.make).toBe('Audi');
    await journeyDraftStore.clear('u1');
    expect(await journeyDraftStore.get('u1')).toBeNull();
    expect(await journeyDraftStore.get('u2')).not.toBeNull();
  });
  test('returns null for a stored draft that is not the right shape', async () => {
    await journeyDraftStore.set('u1', draft);
    const key = (await AsyncStorage.getAllKeys())[0];
    await AsyncStorage.setItem(key, '{"step":3}');
    expect(await journeyDraftStore.get('u1')).toBeNull();
    await AsyncStorage.setItem(key, 'not json');
    expect(await journeyDraftStore.get('u1')).toBeNull();
  });
  test('survives a storage failure', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    expect(await journeyDraftStore.get('u1')).toBeNull();
    spy.mockRestore();
  });
});
