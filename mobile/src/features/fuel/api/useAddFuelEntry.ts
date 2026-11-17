import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

import type { FuelEntryRequest } from '../model/fuelForm';

export function useAddFuelEntry(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: FuelEntryRequest) =>
      unwrap(await api.POST('/vehicles/{vin}/fuel-entries', { params: { path: { vin } }, body })),
    meta: { vin },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.fuel(vin) }),
  });
}
