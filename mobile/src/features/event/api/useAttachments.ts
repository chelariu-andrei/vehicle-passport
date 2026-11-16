import { useQuery } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type AttachmentResponse = components['schemas']['AttachmentResponse'];

export function useAttachments(vin: string, eventId: string) {
  return useQuery({
    queryKey: qk.attachments(vin, eventId),
    queryFn: async () =>
      unwrap(await api.GET('/vehicles/{vin}/events/{eventId}/attachments', { params: { path: { vin, eventId } } })),
    meta: { vin },
  });
}
