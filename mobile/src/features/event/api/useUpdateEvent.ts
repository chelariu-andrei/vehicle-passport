import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, isApiError, qk, unwrap } from '@/shared/api';

import type { EventRequest } from '../model/eventForm';
import { lockedEvents } from '../model/lockedEvents';

/** A full replacement: the caller sends all six fields. */
export function useUpdateEvent(vin: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EventRequest) =>
      unwrap(await api.PUT('/vehicles/{vin}/events/{eventId}', { params: { path: { vin, eventId } }, body })),
    meta: { vin },
    onError: (error) => {
      if (isApiError(error, 'event-from-prior-owner')) lockedEvents.lock(eventId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.timeline(vin) }),
  });
}
