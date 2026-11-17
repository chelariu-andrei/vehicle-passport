import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type FuelEntry = components['schemas']['FuelEntryResponse'];
type FuelEntryPage = components['schemas']['FuelEntryPage'];

const PAGE_SIZE = 30;

function allItems(data: InfiniteData<FuelEntryPage, string | undefined>): FuelEntry[] {
  return data.pages.flatMap((page) => page.items);
}

/** GET /vehicles/{vin}/fuel-entries: newest first, 30 at a time; `data` is every loaded page in one list. */
export function useFuelEntries(vin: string): UseInfiniteQueryResult<FuelEntry[]> {
  return useInfiniteQuery<FuelEntryPage, Error, FuelEntry[], ReturnType<typeof qk.fuel>, string | undefined>({
    queryKey: qk.fuel(vin),
    queryFn: async ({ pageParam }) =>
      unwrap(await api.GET('/vehicles/{vin}/fuel-entries', { params: { path: { vin }, query: { limit: PAGE_SIZE, cursor: pageParam } } })),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    select: allItems,
    meta: { vin },
  });
}
