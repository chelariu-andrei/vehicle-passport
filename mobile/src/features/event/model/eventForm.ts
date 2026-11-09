import { z } from 'zod';

import type { components } from '@/shared/api/generated/schema';

import type { EventResponse } from './timeline';

export type EventType = components['schemas']['EventType'];
export type EventRequest = components['schemas']['EventRequest'];
export const EVENT_TYPES: readonly EventType[] = ['SERVICE', 'REPAIR', 'TIRES', 'ITP'];

const MONEY = /^\d+(?:[.,]\d{1,2})?$/;

/**
 * Reads an amount as typed: a decimal point or a decimal comma, at most two decimals, no sign, no thousands
 * separator. Anything else is null, so "1.234,50" is refused rather than guessed.
 */
export function parseMoney(text: string): number | null {
  const trimmed = text.trim();
  if (!MONEY.test(trimmed)) return null;
  return Number(trimmed.replace(',', '.'));
}

/** `yyyy-mm-dd` of the local calendar day. */
export function formatLocalDate(d: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The latest date the user may pick (P6). The server refuses dates after its UTC today, and a phone east of
 * Greenwich is a day ahead for a few hours, so the limit is the earlier of the local and the UTC day.
 * `offsetMinutes` is `Date.getTimezoneOffset()`: minus 180 in Romania in summer.
 */
export function maxEventDate(now: Date, offsetMinutes: number = now.getTimezoneOffset()): string {
  const local = new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
  const utc = now.toISOString().slice(0, 10);
  return local < utc ? local : utc;
}

/**
 * The event form as the user fills it: every number is the text typed into its field. The output is what the
 * contract accepts. `maxDate` is `maxEventDate(now)`.
 */
export function eventFormSchema(maxDate: string) {
  return z.object({
    type: z.enum(EVENT_TYPES),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((date) => date <= maxDate),
    odometerKm: z
      .string()
      .trim()
      .regex(/^\d{1,9}$/)
      .transform(Number),
    costAmount: z.string().transform((text, ctx) => {
      const amount = parseMoney(text);
      if (amount === null) {
        ctx.addIssue({ code: 'custom', message: 'invalid amount' });
        return z.NEVER;
      }
      return amount;
    }),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/),
    notes: z
      .string()
      .max(2000)
      .transform((text) => text.trim()),
  });
}

export type EventForm = z.output<ReturnType<typeof eventFormSchema>>;

/**
 * The request for a save. An edit is a full replacement, so all six fields always go. A DOCUMENTED event accepts
 * only a notes change: its other fields are resent as the server has them, whatever the form holds.
 */
export function toEventRequest(original: EventResponse | null, form: EventForm): EventRequest {
  const notes = form.notes.trim() === '' ? null : form.notes.trim();
  const base = original?.evidence === 'DOCUMENTED' ? original : form;
  return {
    type: base.type,
    date: base.date,
    odometerKm: base.odometerKm,
    costAmount: base.costAmount,
    currency: base.currency,
    notes,
  };
}
