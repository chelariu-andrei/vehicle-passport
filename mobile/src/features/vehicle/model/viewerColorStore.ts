import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (vin: string) => `viewerColor:${vin}`;

/** The paint the owner chose for a car. A preference only: any failure to read or write it is ignored. */
export const viewerColorStore = {
  async get(vin: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(keyFor(vin));
    } catch {
      return null;
    }
  },
  async set(vin: string, hex: string): Promise<void> {
    try {
      await AsyncStorage.setItem(keyFor(vin), hex);
    } catch {
      // The colour is not remembered; the screen still shows it for this visit.
    }
  },
};
