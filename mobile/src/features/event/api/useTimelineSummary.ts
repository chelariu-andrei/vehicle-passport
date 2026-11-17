import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

import { toQuery, type TimelineFilters } from '../model/timelineFilters';

export type TimelineSummary = components['schemas']['TimelineSummary'];

/** Counts, costs, distance and years for the same filters as the list. The previous answer stays on screen while a new filter loads, so the year chips do not flicker. */
export function useTimelineSummary(vin: string, f: TimelineFilters): UseQueryResult<TimelineSummary> {
  return useQuery({
    queryKey: qk.timelineSummary(vin, f),
    queryFn: async () => unwrap(await api.GET('/vehicles/{vin}/timeline/summary', { params: { path: { vin }, query: toQuery(f) } })),
    placeholderData: keepPreviousData,
    meta: { vin },
  });
}
