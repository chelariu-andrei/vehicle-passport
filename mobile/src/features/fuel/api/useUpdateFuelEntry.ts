import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

import type { FuelEntryRequest } from '../model/fuelForm';

/** A full replacement of the entry. */
export function useUpdateFuelEntry(vin: string, entryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: FuelEntryRequest) =>
      unwrap(await api.PUT('/vehicles/{vin}/fuel-entries/{entryId}', { params: { path: { vin, entryId } }, body })),
    meta: { vin },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.fuel(vin) }),
  });
}
