import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

/**
 * The API has no "list my scan jobs" (integration G1), so the phone remembers the jobs it submitted, with the VIN they
 * were uploaded for and the kept photo.
 */
export type LocalScanJob = { jobId: string; vin: string; localUri: string; submittedAt: string; batchId: string | null };

// Keyed by user id so a second account on the same phone never sees the first one's scans (P5).
const keyFor = (userId: string) => `scans:${userId}`;

function isJob(value: unknown): value is LocalScanJob {
  if (typeof value !== 'object' || value === null) return false;
  const j = value as Record<string, unknown>;
  return (
    typeof j.jobId === 'string' &&
    typeof j.vin === 'string' &&
    typeof j.localUri === 'string' &&
    typeof j.submittedAt === 'string' &&
    (j.batchId === null || typeof j.batchId === 'string')
  );
}

async function read(userId: string): Promise<LocalScanJob[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(keyFor(userId))) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isJob) : [];
  } catch {
    return [];
  }
}

// Writes run one after another so two quick changes cannot overwrite each other.
let queue: Promise<unknown> = Promise.resolve();
function change<T>(userId: string, edit: (jobs: LocalScanJob[]) => { jobs: LocalScanJob[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const before = await read(userId);
    const { jobs, result } = edit(before);
    if (jobs.length !== before.length || jobs.some((j, i) => j !== before[i])) {
      await AsyncStorage.setItem(keyFor(userId), JSON.stringify(jobs));
    }
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Deletes a kept photo. Never throws: a missing file is already what we want. */
export function deleteKeptFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The file is already gone or unreachable; the row is removed regardless.
  }
}

export const scanJobStore = {
  list: (userId: string): Promise<LocalScanJob[]> => queue.then(() => read(userId)),

  /** Appends jobs; one whose id is already stored is ignored. */
  add: (userId: string, added: readonly LocalScanJob[]): Promise<void> =>
    change(userId, (jobs) => ({
      jobs: [...jobs, ...added.filter((a) => !jobs.some((j) => j.jobId === a.jobId))],
      result: undefined,
    })),

  /** Forgets the job and deletes its kept photo. */
  remove: (userId: string, jobId: string): Promise<void> =>
    change(userId, (jobs) => {
      const gone = jobs.find((j) => j.jobId === jobId);
      if (gone) deleteKeptFile(gone.localUri);
      return { jobs: jobs.filter((j) => j.jobId !== jobId), result: undefined };
    }),

  /** A retry: the new job takes the old one's place and the same kept photo, so nothing is deleted. */
  replace: (userId: string, oldJobId: string, job: LocalScanJob): Promise<void> =>
    change(userId, (jobs) => ({ jobs: jobs.map((j) => (j.jobId === oldJobId ? job : j)), result: undefined })),
};
