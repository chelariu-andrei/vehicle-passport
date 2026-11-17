import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type DeadlineItem = components['schemas']['DeadlineItem'];
export type DeadlinesResponse = components['schemas']['DeadlinesResponse'];

/** GET /vehicles/{vin}/deadlines as query options, so one screen and the reminder sync (one query per car) share a cache entry. */
export function deadlinesQuery(vin: string) {
  return queryOptions({
    queryKey: qk.deadlines(vin),
    queryFn: async (): Promise<DeadlinesResponse> => unwrap(await api.GET('/vehicles/{vin}/deadlines', { params: { path: { vin } } })),
    meta: { vin },
  });
}

/** GET /vehicles/{vin}/deadlines: the status of the six documents of one car. */
export function useDeadlines(vin: string, enabled = true): UseQueryResult<DeadlinesResponse> {
  return useQuery({ ...deadlinesQuery(vin), enabled });
}
