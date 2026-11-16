import { useMutation } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { api, unwrap } from '@/shared/api';
import { onSessionEnd } from '@/shared/auth/session';

export const EXPORT_FILE_NAME = 'vehicle-passport-data.json';

/** The share sheet cannot be opened on this device, so nothing was downloaded. */
export class SharingUnavailableError extends Error {
  constructor() {
    super('Sharing is not available on this device');
    this.name = 'SharingUnavailableError';
  }
}

/** Removes the exported file if one is left in the cache. It holds the whole profile, so it never outlives its use; never throws. */
export function sweepStaleExport(): void {
  try {
    const file = new File(Paths.cache, EXPORT_FILE_NAME);
    if (file.exists) file.delete();
  } catch {
    /* nothing to remove, or the system already did */
  }
}

// The next person on this phone must not find the last one's data.
onSessionEnd(sweepStaleExport);

/** GET /me/export, kept in the cache directory (never the documents one) and handed to the share sheet. */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      // Asked first: a device that cannot share must not download (or keep) anything.
      if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
      sweepStaleExport();
      const data = unwrap(await api.GET('/me/export'));
      const file = new File(Paths.cache, EXPORT_FILE_NAME);
      try {
        file.create({ overwrite: true });
        await file.write(JSON.stringify(data, null, 2));
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: EXPORT_FILE_NAME });
      } catch (error) {
        // No half-written file stays on the phone.
        try {
          if (file.exists) file.delete();
        } catch {
          /* already gone */
        }
        throw error;
      }
    },
  });
}
