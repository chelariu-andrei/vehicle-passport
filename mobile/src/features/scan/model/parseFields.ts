import type { components } from '@/shared/api/generated/schema';

export type ScanFields = components['schemas']['ScanFields'];
export type EventType = components['schemas']['EventType'];
export const REVIEW_EVENT_TYPES: readonly EventType[] = ['SERVICE', 'REPAIR', 'TIRES', 'ITP'];

/** Below this a value is flagged "Check" (integration 3.4.3). It never blocks confirmation. */
const LOW_CONFIDENCE = 0.8;

export type Field<T> = { value: T | null; flagged: boolean };
export type DraftPart = { name: string; qty: number | null; price: number | null };
export type ReviewDraft = {
  serviceName: Field<string>;
  date: Field<string>;
  odometerKm: Field<number>;
  total: Field<number>;
  labor: Field<number>;
  parts: DraftPart[];
  partsFlagged: boolean;
  type: EventType;
  currency: string;
  notes: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const amount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);
const kilometres = (value: unknown): number | null => {
  const km = amount(value);
  return km !== null && Number.isInteger(km) ? km : null;
};

/** The raw field, and whether it is reliable: present but unreadable, or under 0.8 confidence, is flagged. */
function read(fields: ScanFields | null | undefined, name: keyof ScanFields): { raw: unknown; low: boolean } {
  const entry: unknown = fields?.[name];
  if (!isRecord(entry) || entry.value === null || entry.value === undefined) return { raw: null, low: false };
  const confidence = entry.confidence;
  return { raw: entry.value, low: typeof confidence !== 'number' || !(confidence >= LOW_CONFIDENCE) };
}

function field<T>(fields: ScanFields | null | undefined, name: keyof ScanFields, parse: (raw: unknown) => T | null): Field<T> {
  const { raw, low } = read(fields, name);
  const value = raw === null ? null : parse(raw);
  return { value, flagged: raw !== null && (low || value === null) };
}

function readParts(raw: unknown): DraftPart[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((part) => ({
    name: typeof part.name === 'string' ? part.name.trim() : '',
    qty: amount(part.qty),
    price: amount(part.price),
  }));
}

/**
 * Reads the untyped `ScanField.value`s defensively (integration G7). Anything missing, null or of the wrong shape
 * becomes an empty input the user can fill, never a crash.
 */
export function parseFields(fields: ScanFields | null | undefined): ReviewDraft {
  const parts = read(fields, 'parts');
  return {
    serviceName: field(fields, 'serviceName', text),
    date: field(fields, 'date', isoDate),
    odometerKm: field(fields, 'odometerKm', kilometres),
    total: field(fields, 'total', amount),
    labor: field(fields, 'labor', amount),
    parts: readParts(parts.raw),
    partsFlagged: parts.raw !== null && (parts.low || !Array.isArray(parts.raw)),
    type: 'SERVICE',
    currency: 'RON',
    notes: null,
  };
}
