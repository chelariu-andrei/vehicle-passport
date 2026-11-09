import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { api, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

import { preparePhoto, PhotoUnusableError } from '../model/preparePhoto';
import type { PreparedPhoto } from '../model/preparePhoto';
import { deleteKeptFile, scanJobStore } from '../model/scanJobStore';
import type { LocalScanJob } from '../model/scanJobStore';

/** Prefix of the on-device job list. These rows are not server state, so they sit outside `qk`. */
export const LOCAL_SCANS = 'localScans';

/** The photo at this position (from 0) could not be prepared. Nothing was sent. */
export class PhotoProblem extends Error {
  constructor(readonly index: number) {
    super(`Photo ${index + 1} cannot be used`);
    this.name = 'PhotoProblem';
  }
}

// Parts are `File` objects from expo-file-system (P2): `fetch` rejects `{ uri, name, type }` parts.
const addPart = (form: FormData, field: string, photo: PreparedPhoto) => {
  const file = new File(photo.uri);
  form.append(field, file as unknown as Blob, file.name);
};

/**
 * One photo is one job; two to twenty are one batch. The server keeps file order, so job i belongs to photo i.
 * The jobs are returned, not stored.
 */
export async function uploadScans(vin: string, photos: PreparedPhoto[]): Promise<LocalScanJob[]> {
  const submittedAt = new Date().toISOString();
  const path = { vin };

  if (photos.length === 1) {
    const form = new FormData();
    addPart(form, 'file', photos[0]);
    const job = unwrap(await api.POST('/vehicles/{vin}/scans', { params: { path }, body: { file: '' }, bodySerializer: () => form }));
    return [{ jobId: job.id, vin, localUri: photos[0].uri, submittedAt, batchId: null }];
  }

  const form = new FormData();
  photos.forEach((photo) => addPart(form, 'files', photo));
  const { jobs } = unwrap(
    await api.POST('/vehicles/{vin}/scan-batches', { params: { path }, body: { files: [] }, bodySerializer: () => form }),
  );
  const batchId = crypto.randomUUID();
  return jobs.map((job, i) => ({ jobId: job.id, vin, localUri: photos[i].uri, submittedAt, batchId }));
}

/** Prepares every photo first (naming the one that fails), uploads, and remembers the jobs. */
export function useUploadScans() {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: async ({ vin, assets }: { vin: string; assets: { uri: string; width: number; height: number }[] }) => {
      if (userId === null) throw new Error('Not signed in');
      const prepared: PreparedPhoto[] = [];
      try {
        for (const [index, asset] of assets.entries()) {
          try {
            prepared.push(await preparePhoto(asset));
          } catch (error) {
            throw error instanceof PhotoUnusableError ? new PhotoProblem(index) : error;
          }
        }
        const jobs = await uploadScans(vin, prepared);
        await scanJobStore.add(userId, jobs);
        return jobs;
      } catch (error) {
        prepared.forEach((photo) => deleteKeptFile(photo.uri));
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [LOCAL_SCANS] }),
  });
}
