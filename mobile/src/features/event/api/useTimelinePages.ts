import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

import type { EventResponse } from '../model/timeline';
import { toQuery, type TimelineFilters } from '../model/timelineFilters';

type TimelinePage = components['schemas']['TimelinePage'];

const PAGE_SIZE = 20;

/** Every loaded page in one list. Module-level, so the selection is stable and only recomputes when the pages change. */
function allItems(data: InfiniteData<TimelinePage, string | undefined>): EventResponse[] {
  return data.pages.flatMap((page) => page.items);
}

/** The filtered timeline, newest first, 20 at a time; `data` is every loaded page in one list. */
export function useTimelinePages(vin: string, f: TimelineFilters): UseInfiniteQueryResult<EventResponse[]> {
  return useInfiniteQuery<TimelinePage, Error, EventResponse[], ReturnType<typeof qk.timelinePages<TimelineFilters>>, string | undefined>({
    queryKey: qk.timelinePages(vin, f),
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET('/vehicles/{vin}/timeline', {
          params: { path: { vin }, query: { ...toQuery(f), order: 'desc', limit: PAGE_SIZE, cursor: pageParam } },
        }),
      ),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: allItems,
    meta: { vin },
  });
}
