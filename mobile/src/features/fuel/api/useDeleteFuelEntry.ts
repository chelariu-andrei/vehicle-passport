import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

export function useDeleteFuelEntry(vin: string, entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      unwrap(await api.DELETE('/vehicles/{vin}/fuel-entries/{entryId}', { params: { path: { vin, entryId } } }));
    },
    meta: { vin },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.fuel(vin) }),
  });
}
