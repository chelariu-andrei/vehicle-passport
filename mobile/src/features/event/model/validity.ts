import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

import type { EventResponse } from './timeline';

export type RovinietaDuration = components['schemas']['RovinietaDuration'];

const DAY_MS = 86_400_000;
const DAYS: Record<Exclude<RovinietaDuration, 'TWELVE_MONTHS'>, number> = {
  ONE_DAY: 1,
  SEVEN_DAYS: 7,
  THIRTY_DAYS: 30,
  NINETY_DAYS: 90,
};

function parse(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both ISO dates); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

/** "12 Mar 2027" for an ISO date. */
export function formatDate(iso: string): string {
  const { y, m, d } = parse(iso);
  const month = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${d} ${month} ${y}`;
}

/**
 * The last day a rovinieta is valid: an N-day one ends N-1 days after `from` (the first day counts); a 12-month one
 * ends the day before the same calendar day a year later (the last day of the month when that day does not exist).
 * The server computes the same value; this is the preview.
 */
export function rovinietaEnd(from: string, duration: RovinietaDuration): string {
  const { y, m, d } = parse(from);
  if (duration !== 'TWELVE_MONTHS') return format(Date.UTC(y, m - 1, d + DAYS[duration] - 1));
  const lastDayOfMonth = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return format(Date.UTC(y + 1, m - 1, Math.min(d, lastDayOfMonth)) - DAY_MS);
}

/** The line under a validity event: how long it is good for. Null when the server has no verdict to show. */
export function validityMarker(e: EventResponse, today: string): { tone: 'ok' | 'warn' | 'danger'; text: string } | null {
  switch (e.validityStatus) {
    case 'VALID':
      return e.validUntil ? { tone: 'ok', text: en.event.validity.validUntil(formatDate(e.validUntil)) } : null;
    case 'EXPIRING':
      return e.validUntil ? { tone: 'warn', text: en.event.validity.expiresIn(daysBetween(today, e.validUntil)) } : null;
    case 'EXPIRED':
      return { tone: 'danger', text: en.event.validity.expired };
    default:
      return null;
  }
}
