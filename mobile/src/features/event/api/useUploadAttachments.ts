import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { ApiError, api, qk, unwrap } from '@/shared/api';

import type { PreparedFile } from '../model/preparedFile';
import type { AttachmentResponse } from './useAttachments';

export type UploadOutcome = {
  uploaded: AttachmentResponse[];
  /** `index` is the file's position in the input; `code` is the problem code, or null when there was none (network, 5xx). */
  failed: { index: number; code: string | null }[];
};

// Parts are `File` objects from expo-file-system (P2): `fetch` rejects `{ uri, name, type }` parts.
const toForm = (prepared: PreparedFile) => {
  const form = new FormData();
  const file = new File(prepared.uri);
  form.append('file', file as unknown as Blob, file.name);
  return form;
};

/**
 * Sends the files one after another. A file the server refuses (a duplicate, say) is recorded as a failure and the
 * rest still go. A 401 or a lost connection is not a refusal of that file, so it ends the run.
 */
export async function uploadAttachments(vin: string, eventId: string, files: PreparedFile[]): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: [], failed: [] };
  for (const [index, prepared] of files.entries()) {
    try {
      const form = toForm(prepared);
      const attachment = unwrap(
        await api.POST('/vehicles/{vin}/events/{eventId}/attachments', {
          params: { path: { vin, eventId } },
          body: { file: '' },
          bodySerializer: () => form,
        }),
      );
      outcome.uploaded.push(attachment);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status === 401) throw error;
      outcome.failed.push({ index, code: error.code });
    }
  }
  return outcome;
}

export function useUploadAttachments(vin: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: PreparedFile[]) => uploadAttachments(vin, eventId, files),
    meta: { vin },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.timeline(vin) }),
        queryClient.invalidateQueries({ queryKey: qk.attachments(vin, eventId) }),
      ]),
  });
}
