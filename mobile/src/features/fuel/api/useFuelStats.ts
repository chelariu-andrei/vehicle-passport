import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type FuelStats = components['schemas']['FuelStatsResponse'];
export type FuelPeriod = '3m' | '6m' | '12m' | 'all';

/** GET /vehicles/{vin}/fuel/stats: consumption, cost and price statistics, computed by the server. */
export function useFuelStats(vin: string, period: FuelPeriod): UseQueryResult<FuelStats> {
  return useQuery({
    queryKey: qk.fuelStats(vin, period),
    queryFn: async (): Promise<FuelStats> =>
      unwrap(await api.GET('/vehicles/{vin}/fuel/stats', { params: { path: { vin }, query: { period } } })),
    meta: { vin },
  });
}
