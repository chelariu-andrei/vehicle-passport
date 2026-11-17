import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type DeadlineItem = components['schemas']['DeadlineItem'];
export type DeadlinesResponse = components['schemas']['DeadlinesResponse'];

/** GET /vehicles/{vin}/deadlines: the status of the six documents of one car. */
export function useDeadlines(vin: string, enabled = true): UseQueryResult<DeadlinesResponse> {
  return useQuery({
    queryKey: qk.deadlines(vin),
    queryFn: async () => unwrap(await api.GET('/vehicles/{vin}/deadlines', { params: { path: { vin } } })),
    meta: { vin },
    enabled,
  });
}
