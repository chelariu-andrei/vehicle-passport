import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { FUEL_TYPES, type FuelType } from './vehicleForm';

const draftSchema = z.object({
  step: z.enum(['vin', 'details']),
  vin: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.string(),
  engine: z.string(),
  fuel: z.enum(FUEL_TYPES as [FuelType, ...FuelType[]]).nullable(),
});

export type JourneyDraft = z.infer<typeof draftSchema>;

export const EMPTY_DRAFT: JourneyDraft = { step: 'vin', vin: '', make: '', model: '', year: '', engine: '', fuel: null };

/** Nothing typed in any field. */
export function isBlank(draft: JourneyDraft): boolean {
  return !draft.vin && !draft.make && !draft.model && !draft.year && !draft.engine && draft.fuel === null;
}

// Keyed by user id so a second account on the same phone never inherits the first one's draft.
const keyFor = (userId: string) => `journeyDraft:${userId}`;

export const journeyDraftStore = {
  async get(userId: string): Promise<JourneyDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(userId));
      if (!raw) return null;
      const parsed = draftSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  },

  async set(userId: string, draft: JourneyDraft): Promise<void> {
    try {
      await AsyncStorage.setItem(keyFor(userId), JSON.stringify(draft));
    } catch {
      // A draft lost on disk costs the user a retype, not an error.
    }
  },

  async clear(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(keyFor(userId));
    } catch {
      // Nothing to clean up if the disk is unreachable.
    }
  },
};
