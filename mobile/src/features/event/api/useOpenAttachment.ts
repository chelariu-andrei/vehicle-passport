import { useMutation } from '@tanstack/react-query';

import { api, saveAndShare, unwrap } from '@/shared/api';

/** Downloads one attached file and opens the share sheet, the way `useEventDocument` does for the original invoice. */
export function useOpenAttachment(vin: string, eventId: string, attachmentId: string, baseName: string) {
  return useMutation({
    mutationFn: async () => {
      const result = await api.GET('/vehicles/{vin}/events/{eventId}/attachments/{attachmentId}', {
        params: { path: { vin, eventId, attachmentId } },
        parseAs: 'arrayBuffer',
      });
      const bytes = unwrap(result) as ArrayBuffer;
      await saveAndShare(bytes, result.response.headers.get('content-type') ?? 'application/octet-stream', baseName);
    },
    meta: { vin },
  });
}
