import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { readPermission, reminderPrompt, requestPermission } from './permission';

const getPermissions = Notifications.getPermissionsAsync as jest.Mock;
const requestPermissions = Notifications.requestPermissionsAsync as jest.Mock;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('permission', () => {
  it.each([
    [{ status: 'granted', granted: true, canAskAgain: true }, 'granted'],
    [{ status: 'undetermined', granted: false, canAskAgain: true }, 'undetermined'],
    [{ status: 'denied', granted: false, canAskAgain: false }, 'denied'],
    [{ status: 'denied', granted: false, canAskAgain: true }, 'denied'],
  ])('reads %j as %s', async (response, expected) => {
    getPermissions.mockResolvedValueOnce(response);
    expect(await readPermission()).toBe(expected);
  });

  it('asks the system and reports the answer', async () => {
    requestPermissions.mockResolvedValueOnce({ status: 'denied', granted: false, canAskAgain: false });
    expect(await requestPermission()).toBe('denied');
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('treats a failing system call as undetermined and never throws', async () => {
    getPermissions.mockRejectedValueOnce(new Error('boom'));
    expect(await readPermission()).toBe('undetermined');
  });
});

describe('reminderPrompt', () => {
  it('remembers that the explanation was shown', async () => {
    expect(await reminderPrompt.wasExplained()).toBe(false);
    await reminderPrompt.markExplained();
    expect(await reminderPrompt.wasExplained()).toBe(true);
  });
});
