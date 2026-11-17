import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function stateOf(response: { status: string; granted?: boolean }): PermissionState {
  if (response.granted || response.status === 'granted') return 'granted';
  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

/** Never throws: a system call that fails reads as "not decided", so nothing is scheduled and nothing crashes. */
export async function readPermission(): Promise<PermissionState> {
  try {
    return stateOf(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/** Shows the system prompt. Call it only after the explanation sheet. */
export async function requestPermission(): Promise<PermissionState> {
  try {
    return stateOf(await Notifications.requestPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

const EXPLAINED = 'reminders.explained';

/** Whether the explanation sheet has been shown on this device; asked once, then never again unprompted. */
export const reminderPrompt = {
  async wasExplained(): Promise<boolean> {
    return (await AsyncStorage.getItem(EXPLAINED)) === '1';
  },
  async markExplained(): Promise<void> {
    await AsyncStorage.setItem(EXPLAINED, '1');
  },
};
