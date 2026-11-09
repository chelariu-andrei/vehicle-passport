import { en } from '@/shared/i18n/en';

import type { EventResponse } from './timeline';

/** The service name of a scan, otherwise the label of the type. */
export function eventTitle(e: EventResponse): string {
  return e.details?.serviceName || en.event.type[e.type];
}

/** Kilometres, then cost. */
export function eventMeta(e: EventResponse): string {
  const km = `${e.odometerKm.toLocaleString('en-US')} km`;
  const cost = `${e.costAmount.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })} ${e.currency}`;
  return `${km} · ${cost}`;
}

/** `events` newest first; the years come out newest first too. */
export function groupByYear(events: EventResponse[]): { year: number; events: EventResponse[] }[] {
  const groups: { year: number; events: EventResponse[] }[] = [];
  for (const event of events) {
    const year = Number(event.date.slice(0, 4));
    const last = groups[groups.length - 1];
    if (last?.year === year) last.events.push(event);
    else groups.push({ year, events: [event] });
  }
  return groups;
}
