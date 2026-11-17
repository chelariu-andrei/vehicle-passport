import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

import type { DocumentKind } from './documentRegistry';

type DeadlineItem = components['schemas']['DeadlineItem'];

export type PlannedReminder = {
  /** 09:00 local on the reminder day. */
  fireAt: Date;
  title: string;
  body: string;
  data: { vin: string; kind: DocumentKind | 'TIRE_WINTER' | 'TIRE_SUMMER' };
};
export type PlanCar = { vin: string; carName: string; items: DeadlineItem[]; lastTiresOn: string | null };
export type PlanPrefs = { documentDeadlines: boolean; reminderDays: number[]; tireSeason: boolean };

/** iOS keeps at most 64 pending local notifications; leave some room. */
export const REMINDER_CAP = 60;

const FIRE_HOUR = 9;
/** Tire-season dates (month 1-12, day). */
const TIRE_SEASONS = [
  { kind: 'TIRE_WINTER', season: 'winter', month: 10, day: 15 },
  { kind: 'TIRE_SUMMER', season: 'summer', month: 4, day: 1 },
] as const;
/** A tire change dated within this many days up to the reminder date skips it. */
const TIRES_RECENT_DAYS = 30;

const REMINDED: ReadonlySet<DeadlineItem['status']> = new Set(['VALID', 'EXPIRING']);

function parse(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** 09:00 local, `daysBefore` calendar days before y-m-d (month 1-12). Built from calendar parts so DST cannot shift the day. */
function nineAm(y: number, m: number, d: number, daysBefore = 0): Date {
  return new Date(y, m - 1, d - daysBefore, FIRE_HOUR, 0, 0);
}

const DAY_MS = 86_400_000;

/** Whole calendar days from the ISO date `from` to the local calendar day of `to` (same rule as `daysBetween` in features/event). */
function daysUntil(from: string, to: Date): number {
  const a = parse(from);
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

function documentReminders(car: PlanCar, days: number[], now: Date): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const it of car.items) {
    if (!REMINDED.has(it.status) || !it.validUntil) continue;
    const { y, m, d } = parse(it.validUntil);
    for (const before of days) {
      const fireAt = nineAm(y, m, d, before);
      if (fireAt.getTime() <= now.getTime()) continue;
      out.push({
        fireAt,
        title: en.deadlines.notification.title(it.kind, before),
        body: en.deadlines.notification.body(car.carName),
        data: { vin: car.vin, kind: it.kind },
      });
    }
  }
  return out;
}

function tireReminders(car: PlanCar, now: Date): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const s of TIRE_SEASONS) {
    let fireAt = nineAm(now.getFullYear(), s.month, s.day);
    if (fireAt.getTime() <= now.getTime()) fireAt = nineAm(now.getFullYear() + 1, s.month, s.day);
    if (car.lastTiresOn) {
      const ago = daysUntil(car.lastTiresOn, fireAt);
      if (ago >= 0 && ago <= TIRES_RECENT_DAYS) continue;
    }
    out.push({
      fireAt,
      title: en.deadlines.notification.tireTitle(s.season),
      body: en.deadlines.notification.tireBody(car.carName),
      data: { vin: car.vin, kind: s.kind },
    });
  }
  return out;
}

/**
 * Every local notification to schedule, earliest first, capped at {@link REMINDER_CAP}. Pure: the caller cancels all
 * deadline notifications and schedules this list again, so a renewed document never keeps its old reminder.
 */
export function reminderPlan(cars: PlanCar[], prefs: PlanPrefs, now: Date): PlannedReminder[] {
  // The expiry day (0) is always included, under the same master switch.
  const days = [...new Set([...prefs.reminderDays, 0])].filter((d) => Number.isInteger(d) && d >= 0);
  const all: PlannedReminder[] = [];
  for (const car of cars) {
    if (prefs.documentDeadlines) all.push(...documentReminders(car, days, now));
    if (prefs.tireSeason) all.push(...tireReminders(car, now));
  }
  return all.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, REMINDER_CAP);
}
