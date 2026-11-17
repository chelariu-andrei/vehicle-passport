import type { Component } from './components';
import type { EventType } from './eventTypes';

/** What the full timeline is narrowed to. `year` is the active year chip; its bounds are in `from`/`to`. */
export type TimelineFilters = { types: EventType[]; components: Component[]; year: number | null; from: string | null; to: string | null };

export const EMPTY_FILTERS: TimelineFilters = { types: [], components: [], year: null, from: null, to: null };

/** Picks a year chip: the period becomes that calendar year. `null` is "All years" and takes the period away. */
export function pickYear(f: TimelineFilters, year: number | null): TimelineFilters {
  if (year === null) return { ...f, year: null, from: null, to: null };
  return { ...f, year, from: `${year}-01-01`, to: `${year}-12-31` };
}

/** Sets a period of its own; no year chip stays active. */
export function setPeriod(f: TimelineFilters, from: string | null, to: string | null): TimelineFilters {
  return { ...f, year: null, from, to };
}

/** The query of `getTimeline` and `getTimelineSummary`, without the filters that are off. */
export function toQuery(f: TimelineFilters): { type?: EventType[]; component?: Component[]; from?: string; to?: string } {
  return {
    ...(f.types.length > 0 ? { type: f.types } : {}),
    ...(f.components.length > 0 ? { component: f.components } : {}),
    ...(f.from !== null ? { from: f.from } : {}),
    ...(f.to !== null ? { to: f.to } : {}),
  };
}

/** Every chosen type and component counts; a year or a period counts once. */
export function activeCount(f: TimelineFilters): number {
  return f.types.length + f.components.length + (f.year !== null || f.from !== null || f.to !== null ? 1 : 0);
}

export type PeriodPreset = 'LAST_12_MONTHS' | 'THIS_YEAR' | 'LAST_YEAR';
export const PERIOD_PRESETS: readonly PeriodPreset[] = ['LAST_12_MONTHS', 'THIS_YEAR', 'LAST_YEAR'];

/** The bounds of a preset period on `today` (an ISO date). The last 12 months end today and start the day after the same day a year ago. */
export function periodPreset(preset: PeriodPreset, today: string): { from: string; to: string } {
  const [year, month, day] = today.split('-').map(Number);
  switch (preset) {
    case 'LAST_12_MONTHS': {
      // The same day a year ago (the month's last day when it does not exist, 29 Feb), then one day on.
      const lastDay = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
      const start = Date.UTC(year - 1, month - 1, Math.min(day, lastDay) + 1);
      return { from: new Date(start).toISOString().slice(0, 10), to: today };
    }
    case 'THIS_YEAR':
      return { from: `${year}-01-01`, to: today };
    case 'LAST_YEAR':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
  }
}
