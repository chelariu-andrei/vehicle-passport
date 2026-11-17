import { z } from 'zod';

import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

import { COMPONENTS } from './components';
import type { Component } from './components';
import { EVENT_TYPE_CONFIG, EVENT_TYPES } from './eventTypes';
import type { EventType } from './eventTypes';
import type { EventResponse } from './timeline';

export { EVENT_TYPES };
export type { EventType };
export type EventRequest = components['schemas']['EventRequest'];
type InsuranceCoverage = components['schemas']['InsuranceCoverage'];
type RovinietaDuration = components['schemas']['RovinietaDuration'];
type ItpResult = components['schemas']['ItpResult'];
type SafetyItem = components['schemas']['SafetyItem'];

export const MAX_CUSTOM_FIELDS = 10;

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

/** The event as the contract takes it: numbers parsed, text trimmed, and only what the type uses. */
export type EventForm = {
  type: EventType;
  date: string;
  odometerKm: number | null;
  costAmount: number;
  currency: string;
  notes: string;
  customLabel: string | null;
  validFrom: string | null;
  validUntil: string | null;
  details: EventRequest['details'];
  components: Component[];
  customFields: { label: string; value: string }[];
};

/** The type-specific boxes, all at once, so that switching type keeps the form's shape. Only the ones the type uses are read. */
export type DetailsInput = {
  coverage: InsuranceCoverage;
  insurer: string;
  policyNumber: string;
  duration: RovinietaDuration;
  station: string;
  result: ItpResult | '';
  item: SafetyItem | '';
};

/** The event form as the user fills it: every number is the text typed into its field. */
export type EventFormInput = {
  type: EventType;
  date: string;
  odometerKm: string;
  costAmount: string;
  currency: string;
  notes: string;
  customLabel: string;
  validFrom: string;
  validUntil: string;
  details: DetailsInput;
  components: Component[];
  customFields: { label: string; value: string }[];
};

export const EMPTY_DETAILS: DetailsInput = { coverage: 'RCA', insurer: '', policyNumber: '', duration: 'THIRTY_DAYS', station: '', result: '', item: '' };

const KM = /^\d{1,9}$/;
const CURRENCY = /^[A-Z]{3}$/;

function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

const structure = z.object({
  type: z.enum(EVENT_TYPES as [EventType, ...EventType[]]),
  date: z.string(),
  odometerKm: z.string(),
  costAmount: z.string(),
  currency: z.string(),
  notes: z.string(),
  customLabel: z.string(),
  validFrom: z.string(),
  validUntil: z.string(),
  details: z.object({
    coverage: z.enum(['RCA', 'CASCO']),
    insurer: z.string(),
    policyNumber: z.string(),
    duration: z.enum(['ONE_DAY', 'SEVEN_DAYS', 'THIRTY_DAYS', 'NINETY_DAYS', 'TWELVE_MONTHS']),
    station: z.string(),
    result: z.enum(['', 'PASSED', 'PASSED_WITH_REMARKS', 'FAILED']),
    item: z.enum(['', 'FIRE_EXTINGUISHER', 'FIRST_AID_KIT']),
  }),
  components: z.array(z.enum(COMPONENTS as unknown as [Component, ...Component[]])),
  customFields: z.array(z.object({ label: z.string(), value: z.string() })),
});

/**
 * The rules of one type, read from its registry entry: which boxes count, which are required, and what the
 * contract gets. Every problem is reported in one pass, at the box that holds it. `maxDate` is `maxEventDate(now)`.
 */
export function eventFormSchema(type: EventType, maxDate: string): z.ZodType<EventForm, EventFormInput> {
  const config = EVENT_TYPE_CONFIG[type];
  return structure.transform((v, ctx): EventForm => {
    let valid = true;
    const refuse = (path: (string | number)[], message: string) => {
      valid = false;
      ctx.addIssue({ code: 'custom', message, path });
    };

    const date = v.date.trim();
    if (!isDate(date) || date > maxDate) refuse(['date'], en.event.invalidDate);

    const km = v.odometerKm.trim();
    let odometerKm: number | null = null;
    if (km === '' && config.odometer === 'optional') odometerKm = null;
    else if (!KM.test(km)) refuse(['odometerKm'], en.event.invalidOdometer);
    else odometerKm = Number(km);

    const amount = parseMoney(v.costAmount);
    if (amount === null) refuse(['costAmount'], en.event.invalidCost);
    const currency = v.currency.trim().toUpperCase();
    if (!CURRENCY.test(currency)) refuse(['currency'], en.event.invalidCurrency);
    if (v.notes.length > 2000) refuse(['notes'], en.event.notesTooLong);

    let customLabel: string | null = null;
    if (config.customLabel) {
      customLabel = v.customLabel.trim();
      if (customLabel === '' || customLabel.length > 60) refuse(['customLabel'], en.event.invalidLabel);
    }

    const from = v.validFrom.trim();
    const until = v.validUntil.trim();
    let validFrom: string | null = null;
    let validUntil: string | null = null;
    const usesFrom = config.validity === 'computed' || config.validity === 'range';
    const usesUntil = config.validity === 'untilOptional' || config.validity === 'untilRequired' || config.validity === 'range';
    if (usesFrom) {
      if (isDate(from)) validFrom = from;
      else refuse(['validFrom'], en.event.invalidValidFrom);
    }
    if (usesUntil && !(until === '' && config.validity === 'untilOptional')) {
      if (!isDate(until)) refuse(['validUntil'], en.event.invalidValidUntil);
      else if (validFrom !== null && until < validFrom) refuse(['validUntil'], en.event.invalidPeriod);
      else validUntil = until;
    }

    let details: EventForm['details'] = null;
    const d = v.details;
    switch (config.details) {
      case 'INSURANCE': {
        const insurer = d.insurer.trim();
        const policy = d.policyNumber.trim();
        if (insurer === '' || insurer.length > 100) refuse(['details', 'insurer'], en.event.invalidInsurer);
        if (policy.length > 60) refuse(['details', 'policyNumber'], en.event.policyNumberTooLong);
        details = { kind: 'INSURANCE', coverage: d.coverage, insurer, policyNumber: policy === '' ? null : policy };
        break;
      }
      case 'ROVINIETA':
        details = { kind: 'ROVINIETA', duration: d.duration };
        break;
      case 'ITP': {
        const station = d.station.trim();
        if (station.length > 100) refuse(['details', 'station'], en.event.stationTooLong);
        if (station !== '' || d.result !== '') details = { kind: 'ITP', station: station === '' ? null : station, result: d.result === '' ? null : d.result };
        break;
      }
      case 'SAFETY_EQUIPMENT':
        if (d.item === '') refuse(['details', 'item'], en.event.invalidItem);
        else details = { kind: 'SAFETY_EQUIPMENT', item: d.item };
        break;
      case null:
        break;
    }

    const customFields: EventForm['customFields'] = [];
    v.customFields.forEach((row, index) => {
      const label = row.label.trim();
      const value = row.value.trim();
      if (label === '' && value === '') return;
      if (label === '' || value === '' || label.length > 40 || value.length > 200) refuse(['customFields', index], en.event.invalidCustomFields);
      else customFields.push({ label, value });
    });
    if (customFields.length > MAX_CUSTOM_FIELDS) refuse(['customFields'], en.event.tooManyCustomFields);

    if (!valid) return z.NEVER;
    return {
      type,
      date,
      odometerKm,
      costAmount: amount!,
      currency,
      notes: v.notes.trim(),
      customLabel,
      validFrom,
      validUntil,
      details,
      components: v.components,
      customFields,
    };
  });
}

/**
 * The request for a save. An edit is a full replacement, so everything the type uses goes, and nothing it does not:
 * the server refuses a leftover detail or date from another type. A DOCUMENTED event's facts are resent as the server
 * has them (with its validity and its sendable details; scan details cannot be sent, so they are left out), and the
 * form only supplies notes, components and custom fields.
 */
export function toEventRequest(original: EventResponse | null, form: EventForm): EventRequest {
  const base = original?.evidence === 'DOCUMENTED' ? original : form;
  const config = EVENT_TYPE_CONFIG[base.type];
  const notes = form.notes.trim() === '' ? null : form.notes.trim();
  const request: EventRequest = {
    type: base.type,
    date: base.date,
    odometerKm: base.odometerKm ?? null,
    costAmount: base.costAmount,
    currency: base.currency,
    notes,
    components: form.components,
    customFields: form.customFields,
  };
  if (config.customLabel && base.customLabel) request.customLabel = base.customLabel;
  if ((config.validity === 'computed' || config.validity === 'range') && base.validFrom) request.validFrom = base.validFrom;
  if ((config.validity === 'untilOptional' || config.validity === 'untilRequired' || config.validity === 'range') && base.validUntil) {
    request.validUntil = base.validUntil;
  }
  const details = base.details;
  if (config.details !== null && details && details.kind === config.details) request.details = details;
  return request;
}

/** The details boxes of an event the server sent; scan details have none. */
export function detailsInputOf(details: EventResponse['details']): DetailsInput {
  switch (details?.kind) {
    case 'INSURANCE':
      return { ...EMPTY_DETAILS, coverage: details.coverage, insurer: details.insurer, policyNumber: details.policyNumber ?? '' };
    case 'ROVINIETA':
      return { ...EMPTY_DETAILS, duration: details.duration };
    case 'ITP':
      return { ...EMPTY_DETAILS, station: details.station ?? '', result: details.result ?? '' };
    case 'SAFETY_EQUIPMENT':
      return { ...EMPTY_DETAILS, item: details.item };
    default:
      return EMPTY_DETAILS;
  }
}

/** A new form starts as a service today. */
export function newFormInput(maxDate: string): EventFormInput {
  return {
    ...typeDefaults('SERVICE', maxDate),
    type: 'SERVICE',
    date: maxDate,
    odometerKm: '',
    costAmount: '',
    currency: 'RON',
    notes: '',
    customFields: [],
  };
}

/** The boxes of an existing event, as text. */
export function formInputOf(original: EventResponse): EventFormInput {
  return {
    type: original.type,
    date: original.date,
    odometerKm: original.odometerKm === null ? '' : String(original.odometerKm),
    costAmount: String(original.costAmount),
    currency: original.currency,
    notes: original.notes ?? '',
    customLabel: original.customLabel ?? '',
    validFrom: original.validFrom ?? '',
    validUntil: original.validUntil ?? '',
    details: detailsInputOf(original.details),
    components: original.components,
    customFields: original.customFields.map((f) => ({ label: f.label, value: f.value })),
  };
}

/**
 * What changing the type resets: the type-specific boxes go back to empty, the components to the type's suggestion, and a
 * type that counts from a start date starts at `date`. Notes, cost and custom fields are the person's and stay.
 */
/** What a new form starts with when it is opened for one document (from the deadlines screen). */
export type EventPreset = { type: EventType; coverage?: 'RCA' | 'CASCO'; item?: 'FIRE_EXTINGUISHER' | 'FIRST_AID_KIT' };

/** A new form for `preset`: the type's own defaults, with the coverage or item already chosen. */
export function presetFormInput(maxDate: string, preset: EventPreset): EventFormInput {
  const base = newFormInput(maxDate);
  const details = { ...EMPTY_DETAILS, ...(preset.coverage ? { coverage: preset.coverage } : {}), ...(preset.item ? { item: preset.item } : {}) };
  return { ...base, ...typeDefaults(preset.type, maxDate), type: preset.type, details };
}

/** Reads route params into a preset; anything unknown is ignored, and no valid type means no preset. */
export function parsePreset(params: Record<string, string | string[] | undefined>): EventPreset | null {
  const type = EVENT_TYPES.find((t) => t === params.type);
  if (!type) return null;
  const preset: EventPreset = { type };
  if (type === 'INSURANCE' && (params.coverage === 'RCA' || params.coverage === 'CASCO')) preset.coverage = params.coverage;
  if (type === 'SAFETY_EQUIPMENT' && (params.item === 'FIRE_EXTINGUISHER' || params.item === 'FIRST_AID_KIT')) preset.item = params.item;
  return preset;
}

export function typeDefaults(type: EventType, date: string): Pick<EventFormInput, 'customLabel' | 'validFrom' | 'validUntil' | 'details' | 'components'> {
  const config = EVENT_TYPE_CONFIG[type];
  return {
    customLabel: '',
    validFrom: config.validity === 'computed' || config.validity === 'range' ? date : '',
    validUntil: '',
    details: EMPTY_DETAILS,
    components: [...config.defaultComponents],
  };
}
