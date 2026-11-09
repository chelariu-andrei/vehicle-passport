import { api, isApiError, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';
import type { Evidence } from '@/shared/design';

export type EventResponse = components['schemas']['EventResponse'];

const PAGE_SIZE = 100;

/** Pages arrive oldest first, as the server sends them. */
async function loadPages(vin: string): Promise<EventResponse[]> {
  const items: EventResponse[] = [];
  let cursor: string | undefined;
  do {
    const page = unwrap(
      await api.GET('/vehicles/{vin}/timeline', { params: { path: { vin }, query: { limit: PAGE_SIZE, cursor } } }),
    );
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

/**
 * Every event of the car, newest first. The server has no sort option, so the app loads all pages and reverses.
 * A cursor the server refuses restarts from page one, once (P11); a second refusal is an error.
 */
export async function fetchFullTimeline(vin: string): Promise<EventResponse[]> {
  try {
    return (await loadPages(vin)).reverse();
  } catch (error) {
    if (!isApiError(error, 'invalid-cursor')) throw error;
    return (await loadPages(vin)).reverse();
  }
}

/** The odometer of the newest entry, with that entry's evidence. `events` is newest first. */
export function latestOdometer(events: readonly EventResponse[]): { km: number; evidence: Evidence } | null {
  const latest = events[0];
  return latest ? { km: latest.odometerKm, evidence: latest.evidence } : null;
}
