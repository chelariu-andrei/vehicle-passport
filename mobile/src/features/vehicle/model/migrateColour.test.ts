import AsyncStorage from '@react-native-async-storage/async-storage';

import { migrateColour } from './migrateColour';

const VIN = 'WBA8E1C50GK123456';
const KEY = `viewerColor:${VIN}`;

beforeEach(async () => {
  await AsyncStorage.clear();
});

it.each([
  ['#0f1a15', 'BLACK'],
  ['#d9dedb', 'SILVER'],
  ['#1c6b49', 'GREEN'],
  ['#a3171d', 'RED'],
])('%s becomes %s and the key is removed', async (hex, color) => {
  await AsyncStorage.setItem(KEY, hex);
  const save = jest.fn().mockResolvedValue(undefined);
  await expect(migrateColour(VIN, false, save)).resolves.toBe('migrated');
  expect(save).toHaveBeenCalledWith({ color });
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});

it('does nothing for a car that already has a look, but removes the key', async () => {
  await AsyncStorage.setItem(KEY, '#a3171d');
  const save = jest.fn();
  await expect(migrateColour(VIN, true, save)).resolves.toBe('nothing');
  expect(save).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});

it('does nothing with no stored colour', async () => {
  const save = jest.fn();
  await expect(migrateColour(VIN, false, save)).resolves.toBe('nothing');
  expect(save).not.toHaveBeenCalled();
});

it('keeps the key when the save fails', async () => {
  await AsyncStorage.setItem(KEY, '#a3171d');
  const save = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(migrateColour(VIN, false, save)).resolves.toBe('failed');
  expect(await AsyncStorage.getItem(KEY)).toBe('#a3171d');
});

it('ignores an unknown stored value and removes it', async () => {
  await AsyncStorage.setItem(KEY, 'teal');
  const save = jest.fn();
  await expect(migrateColour(VIN, false, save)).resolves.toBe('nothing');
  expect(save).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem(KEY)).toBeNull();
});
