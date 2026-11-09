import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

import type { UpdateVehicleRequest } from '../model/changedFields';

/** Sends only what changed. The caller guarantees at least one field (Save is disabled until then). */
export function useUpdateVehicle(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<UpdateVehicleRequest>) =>
      unwrap(await api.PATCH('/vehicles/{vin}', { params: { path: { vin } }, body })),
    meta: { vin },
    onSuccess: (vehicle) => queryClient.setQueryData(qk.vehicle(vin), vehicle),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.vehicle(vin) }),
        queryClient.invalidateQueries({ queryKey: qk.vehicles }),
      ]),
  });
}
