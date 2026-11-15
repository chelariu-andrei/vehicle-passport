import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PaintColor } from '@/shared/viewer';

const keyFor = (vin: string) => `viewerColor:${vin}`;

/** The four paints the old viewer offered, and the named colour each one stands for now. */
const OLD_PAINTS: Record<string, PaintColor> = {
  '#0f1a15': 'BLACK',
  '#d9dedb': 'SILVER',
  '#1c6b49': 'GREEN',
  '#a3171d': 'RED',
};

/**
 * The colour once chosen on this phone moves to the server, once. A car that already has a look keeps it. The stored
 * value is removed when it has been moved or is of no use; a failed save keeps it for the next visit.
 */
export async function migrateColour(
  vin: string,
  hasLook: boolean,
  save: (appearance: { color: PaintColor }) => Promise<unknown>,
): Promise<'migrated' | 'nothing' | 'failed'> {
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(keyFor(vin));
  } catch {
    return 'nothing';
  }
  if (stored === null) return 'nothing';
  const color = hasLook ? undefined : OLD_PAINTS[stored.toLowerCase()];
  if (color) {
    try {
      await save({ color });
    } catch {
      return 'failed';
    }
  }
  try {
    await AsyncStorage.removeItem(keyFor(vin));
  } catch {
    // It is read again next time and does nothing then.
  }
  return color ? 'migrated' : 'nothing';
}
