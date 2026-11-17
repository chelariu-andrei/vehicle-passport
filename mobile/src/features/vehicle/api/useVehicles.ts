import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type VehicleResponse = components['schemas']['VehicleResponse'];

/** The garage. `enabled` lets a caller wait, such as until the account may use the app. */
export function useVehicles(enabled = true) {
  return useQuery({ queryKey: qk.vehicles, queryFn: async () => unwrap(await api.GET('/vehicles')), enabled });
}

/** One car. Starts from the garage list when that is already loaded, then refreshes. */
export function useVehicle(vin: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.vehicle(vin),
    queryFn: async () => unwrap(await api.GET('/vehicles/{vin}', { params: { path: { vin } } })),
    meta: { vin },
    initialData: () => queryClient.getQueryData<VehicleResponse[]>(qk.vehicles)?.find((v) => v.vin === vin),
    initialDataUpdatedAt: () => queryClient.getQueryState(qk.vehicles)?.dataUpdatedAt,
  });
}
