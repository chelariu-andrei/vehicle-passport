import { z } from 'zod';

import { parseMoney } from '@/features/event';
import type { components } from '@/shared/api/generated/schema';

import { REVIEW_EVENT_TYPES } from './parseFields';
import type { DraftPart, Field, ReviewDraft } from './parseFields';

export type ConfirmScanRequest = components['schemas']['ConfirmScanRequest'];

/** The review form as the user fills it: every number is the text typed into its box. */
export type ReviewForm = {
  serviceName: string;
  date: string;
  odometerKm: string;
  total: string;
  labor: string;
  parts: { name: string; qty: string; price: string }[];
  type: ReviewDraft['type'];
  currency: string;
  notes: string;
};

const num = (n: number | null): string => (n === null ? '' : String(n));

export function toForm(d: ReviewDraft): ReviewForm {
  return {
    serviceName: d.serviceName.value ?? '',
    date: d.date.value ?? '',
    odometerKm: num(d.odometerKm.value),
    total: num(d.total.value),
    labor: num(d.labor.value),
    parts: d.parts.map((p) => ({ name: p.name, qty: num(p.qty), price: num(p.price) })),
    type: d.type,
    currency: d.currency,
    notes: d.notes ?? '',
  };
}

const unflagged = <T>(value: T | null): Field<T> => ({ value, flagged: false });
const INVALID = 'invalid';

/** An empty box is a missing value; a box with text that is not a value is an issue on that box. */
const optional = <T>(read: (text: string) => T | null) =>
  z.string().transform((raw, ctx): Field<T> => {
    const trimmed = raw.trim();
    if (trimmed === '') return unflagged<T>(null);
    const value = read(trimmed);
    if (value === null) {
      ctx.addIssue({ code: 'custom', message: INVALID });
      return z.NEVER;
    }
    return unflagged(value);
  });

const date = optional((t) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const parsed = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== t ? null : t;
});
const kilometres = optional((t) => (/^\d{1,9}$/.test(t) ? Number(t) : null));
const money = optional(parseMoney);
const plain = optional((t) => t);
const partAmount = z.string().transform((raw, ctx): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = parseMoney(trimmed);
  if (value === null) {
    ctx.addIssue({ code: 'custom', message: INVALID });
    return z.NEVER;
  }
  return value;
});

/** Turns the typed form into a draft. Presence is checked afterwards by `toConfirmRequest`. */
export const reviewFormSchema = z
  .object({
    serviceName: plain,
    date,
    odometerKm: kilometres,
    total: money,
    labor: money,
    parts: z.array(z.object({ name: z.string().transform((n) => n.trim()), qty: partAmount, price: partAmount })),
    type: z.enum(REVIEW_EVENT_TYPES),
    currency: z.string().transform((c) => c.trim().toUpperCase()),
    notes: z.string().max(2000).transform((n) => n.trim()),
  })
  .transform(
    (form): ReviewDraft => ({
      ...form,
      partsFlagged: false,
      notes: form.notes === '' ? null : form.notes,
    }),
  );

const blank = (p: DraftPart) => p.name === '' && p.qty === null && p.price === null;

/**
 * The confirm body, or the fields still to be filled in. `date`, `odometerKm`, `total`, and each kept part's
 * `name`, `qty` and `price` are required by the contract (P7). Parts are named `parts.<index>.<field>`.
 */
export function toConfirmRequest(d: ReviewDraft): ConfirmScanRequest | { missing: string[] } {
  const missing: string[] = [];
  if (d.date.value === null) missing.push('date');
  if (d.odometerKm.value === null) missing.push('odometerKm');
  if (d.total.value === null) missing.push('total');
  const parts: ConfirmScanRequest['parts'] = [];
  d.parts.forEach((p, i) => {
    if (blank(p)) return;
    if (p.name === '') missing.push(`parts.${i}.name`);
    if (p.qty === null) missing.push(`parts.${i}.qty`);
    if (p.price === null) missing.push(`parts.${i}.price`);
    if (p.qty !== null && p.price !== null && p.name !== '') parts.push({ name: p.name, qty: p.qty, price: p.price });
  });
  if (!/^[A-Z]{3}$/.test(d.currency)) missing.push('currency');
  if (missing.length > 0) return { missing };
  return {
    type: d.type,
    serviceName: d.serviceName.value,
    date: d.date.value!,
    odometerKm: d.odometerKm.value!,
    parts,
    labor: d.labor.value,
    total: d.total.value!,
    currency: d.currency,
    notes: d.notes,
  };
}
