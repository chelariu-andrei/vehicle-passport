import { useMutation } from '@tanstack/react-query';

import { api, saveAndShare, unwrap } from '@/shared/api';

/**
 * Downloads the original invoice and opens the share sheet. The bytes go through the API client so that a 403
 * `document-restricted` keeps its body and a 401 is refreshed (P3).
 */
export function useEventDocument(vin: string, eventId: string, baseName: string) {
  return useMutation({
    mutationFn: async () => {
      const result = await api.GET('/vehicles/{vin}/events/{eventId}/document', {
        params: { path: { vin, eventId } },
        parseAs: 'arrayBuffer',
      });
      const bytes = unwrap(result) as ArrayBuffer;
      await saveAndShare(bytes, result.response.headers.get('content-type') ?? 'application/octet-stream', baseName);
    },
    meta: { vin },
  });
}
