import AsyncStorage from '@react-native-async-storage/async-storage';

/** The API has no "my pending claims" endpoint (integration G2), so the phone remembers the ones it filed. */
export type LocalClaim = { claimId: string; vin: string; filedAt: string };

// Keyed by user id so a second account on the same phone never sees the first one's claims (P5).
const keyFor = (userId: string) => `claims:${userId}`;

function isClaim(value: unknown): value is LocalClaim {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.claimId === 'string' && typeof c.vin === 'string' && typeof c.filedAt === 'string';
}

async function read(userId: string): Promise<LocalClaim[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(keyFor(userId))) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isClaim) : [];
  } catch {
    return [];
  }
}

// Writes run one after another so two quick changes cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function change<T>(userId: string, edit: (claims: LocalClaim[]) => { claims: LocalClaim[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const before = await read(userId);
    const { claims, result } = edit(before);
    if (claims.length !== before.length || claims.some((c, i) => c !== before[i])) {
      await AsyncStorage.setItem(keyFor(userId), JSON.stringify(claims));
    }
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const claimStore = {
  list: (userId: string): Promise<LocalClaim[]> => queue.then(() => read(userId)),

  upsert: (userId: string, claim: LocalClaim): Promise<void> =>
    change(userId, (claims) => ({
      claims: [...claims.filter((c) => c.claimId !== claim.claimId), claim],
      result: undefined,
    })),

  remove: (userId: string, claimId: string): Promise<void> =>
    change(userId, (claims) => ({ claims: claims.filter((c) => c.claimId !== claimId), result: undefined })),

  /** A claim whose VIN is now in the garage was approved. Drops those and returns the claims still waiting. */
  dropResolved: (userId: string, garageVins: readonly string[]): Promise<LocalClaim[]> =>
    change(userId, (claims) => {
      const rest = claims.filter((c) => !garageVins.includes(c.vin));
      return { claims: rest, result: rest };
    }),
};
