import { queryOptions } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

/**
 * The date of the car's latest tire change (`TIRES` event), or null when there is none: one event, newest first. The
 * tire-season reminder is skipped when the tires were changed shortly before it.
 */
export function lastTiresQuery(vin: string) {
  return queryOptions({
    queryKey: qk.lastTires(vin),
    queryFn: async (): Promise<string | null> => {
      const page = unwrap(
        await api.GET('/vehicles/{vin}/timeline', {
          params: { path: { vin }, query: { type: ['TIRES'], order: 'desc', limit: 1 } },
        }),
      );
      return page.items[0]?.date ?? null;
    },
    meta: { vin },
  });
}
