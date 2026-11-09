import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

import type { EventRequest } from '../model/eventForm';

export function useAddEvent(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: EventRequest) =>
      unwrap(await api.POST('/vehicles/{vin}/events', { params: { path: { vin } }, body })),
    meta: { vin },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.timeline(vin) }),
  });
}
