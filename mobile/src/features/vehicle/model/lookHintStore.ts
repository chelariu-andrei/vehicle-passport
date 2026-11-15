import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (vin: string) => `lookHintDismissed:${vin}`;

/** Whether the owner dismissed the "Make it yours" row on a car's home screen. Remembered per car on this phone. */
export const lookHintStore = {
  async isDismissed(vin: string): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(keyFor(vin))) === '1';
    } catch {
      return false;
    }
  },
  async dismiss(vin: string): Promise<void> {
    try {
      await AsyncStorage.setItem(keyFor(vin), '1');
    } catch {
      // The row simply returns next time.
    }
  },
};
