import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, isApiError, qk, unwrap } from '@/shared/api';

import { lockedEvents } from '../model/lockedEvents';

export function useDeleteEvent(vin: string, eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE('/vehicles/{vin}/events/{eventId}', { params: { path: { vin, eventId } } }));
    },
    meta: { vin },
    onError: (error) => {
      if (isApiError(error, 'event-from-prior-owner')) lockedEvents.lock(eventId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.timeline(vin) }),
  });
}
