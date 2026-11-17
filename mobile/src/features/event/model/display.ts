import type { EventResponse } from './timeline';

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

/** "10 Mar" for an ISO date; the year is the label above the row. */
export function dayAndMonth(isoDate: string): { day: string; month: string } {
  const [, month, day] = isoDate.split('-').map(Number);
  const name = new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return { day: String(day), month: name };
}
