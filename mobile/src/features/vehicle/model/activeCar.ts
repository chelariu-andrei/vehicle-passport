import AsyncStorage from '@react-native-async-storage/async-storage';

// Keyed by user id so a second account on the same phone never inherits the first one's choice.
const keyFor = (userId: string) => `activeCar:${userId}`;

export const activeCarStore = {
  async get(userId: string): Promise<string | null> {
    try {
      return (await AsyncStorage.getItem(keyFor(userId))) || null;
    } catch {
      return null;
    }
  },

  async set(userId: string, vin: string): Promise<void> {
    try {
      await AsyncStorage.setItem(keyFor(userId), vin);
    } catch {
      // The choice stays in the query cache for this run; losing it on disk is not worth an error.
    }
  },
};

/** The stored car if it is still in the garage, else the first car, else none. */
export function pickActive(cars: readonly { vin: string }[], stored: string | null): string | null {
  if (stored !== null && cars.some((c) => c.vin === stored)) return stored;
  return cars[0]?.vin ?? null;
}
