import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, isApiError } from './apiError';
import { registerOnlineStatus } from './onlineStatus';

const GONE_WINDOW_MS = 5000;

/** When each client last handled a car leaving, per VIN. Keeps one departure from being announced twice. */
const departures = new WeakMap<QueryClient, Map<string, number>>();

/**
 * The car is leaving on purpose (given up, handed over). Screens still mounted may refetch it once more and get a
 * 404; for the next few seconds that is expected and must not raise the "no longer in your garage" notice.
 */
export function expectDeparture(queryClient: QueryClient, vin: string): void {
  departures.get(queryClient)?.set(vin, Date.now());
}

/** Reads are not retried when the server answered; a dropped connection gets one more try. */
const retry = (failureCount: number, error: unknown) => !(error instanceof ApiError) && failureCount < 1;

export function createAppQueryClient(opts: { onVehicleGone(vin: string): void }): QueryClient {
  registerOnlineStatus();
  const lastFired = new Map<string, number>();

  const check = (error: unknown, meta: Record<string, unknown> | undefined) => {
    const vin = meta?.vin;
    if (typeof vin !== 'string' || !isApiError(error, 'vehicle-not-found')) return;
    const now = Date.now();
    const previous = lastFired.get(vin);
    if (previous !== undefined && now - previous < GONE_WINDOW_MS) return;
    lastFired.set(vin, now);
    opts.onVehicleGone(vin);
  };

  const client = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => check(error, query.meta) }),
    mutationCache: new MutationCache({ onError: (error, _variables, _context, mutation) => check(error, mutation.meta) }),
    defaultOptions: { queries: { retry }, mutations: { retry: false } },
  });
  departures.set(client, lastFired);
  return client;
}
