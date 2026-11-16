import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, isApiError, qk, unwrap } from '@/shared/api';

import { lockedEvents } from '../model/lockedEvents';

export function useDeleteAttachment(vin: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      unwrap(
        await api.DELETE('/vehicles/{vin}/events/{eventId}/attachments/{attachmentId}', {
          params: { path: { vin, eventId, attachmentId } },
        }),
      );
    },
    meta: { vin },
    onError: (error) => {
      if (isApiError(error, 'event-from-prior-owner')) lockedEvents.lock(eventId);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.timeline(vin) }),
        queryClient.invalidateQueries({ queryKey: qk.attachments(vin, eventId) }),
      ]),
  });
}
