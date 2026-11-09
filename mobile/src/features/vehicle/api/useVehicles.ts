import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type VehicleResponse = components['schemas']['VehicleResponse'];

export function useVehicles() {
  return useQuery({ queryKey: qk.vehicles, queryFn: async () => unwrap(await api.GET('/vehicles')) });
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
