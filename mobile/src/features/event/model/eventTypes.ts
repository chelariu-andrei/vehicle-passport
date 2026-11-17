import type { components } from '@/shared/api/generated/schema';
import type { ColorName as ColorToken, IconName } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { Component } from './components';
import type { EventResponse } from './timeline';
import { formatDate } from './validity';

export type EventType = components['schemas']['EventType'];
export type { Component };

export type EventTypeConfig = {
  icon: IconName;
  tint: ColorToken;
  label: () => string;
  odometer: 'required' | 'optional';
  validity: 'none' | 'untilOptional' | 'untilRequired' | 'computed' | 'range';
  details: 'INSURANCE' | 'ROVINIETA' | 'ITP' | 'SAFETY_EQUIPMENT' | null;
  customLabel: boolean;
  defaultComponents: Component[];
  /** The hint above the documents section; null for the generic copy. */
  documentHint: (() => string) | null;
};

/** Display order of the type picker. */
export const EVENT_TYPES: readonly EventType[] = ['SERVICE', 'REPAIR', 'TIRES', 'ITP', 'ROVINIETA', 'INSURANCE', 'SAFETY_EQUIPMENT', 'OTHER'];

/** The one place that knows what each type means; a missing type fails to compile. Components read it instead of branching on a type. */
export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig> = {
  SERVICE: {
    icon: 'wrench',
    tint: 'brand',
    label: () => en.event.type.SERVICE,
    odometer: 'required',
    validity: 'none',
    details: null,
    customLabel: false,
    defaultComponents: [],
    documentHint: null,
  },
  REPAIR: {
    icon: 'car',
    tint: 'warning',
    label: () => en.event.type.REPAIR,
    odometer: 'required',
    validity: 'none',
    details: null,
    customLabel: false,
    defaultComponents: [],
    documentHint: null,
  },
  TIRES: {
    icon: 'wheel',
    tint: 'evidence-confirmed',
    label: () => en.event.type.TIRES,
    odometer: 'required',
    validity: 'none',
    details: null,
    customLabel: false,
    defaultComponents: ['TIRES_WHEELS'],
    documentHint: null,
  },
  ITP: {
    icon: 'check',
    tint: 'evidence-verified',
    label: () => en.event.type.ITP,
    odometer: 'required',
    validity: 'untilOptional',
    details: 'ITP',
    customLabel: false,
    defaultComponents: [],
    documentHint: () => en.event.documentHint.ITP,
  },
  ROVINIETA: {
    icon: 'road',
    tint: 'evidence-estimated',
    label: () => en.event.type.ROVINIETA,
    odometer: 'optional',
    validity: 'computed',
    details: 'ROVINIETA',
    customLabel: false,
    defaultComponents: [],
    documentHint: () => en.event.documentHint.ROVINIETA,
  },
  INSURANCE: {
    icon: 'shield',
    tint: 'evidence-documented',
    label: () => en.event.type.INSURANCE,
    odometer: 'optional',
    validity: 'range',
    details: 'INSURANCE',
    customLabel: false,
    defaultComponents: [],
    documentHint: () => en.event.documentHint.INSURANCE,
  },
  SAFETY_EQUIPMENT: {
    icon: 'kit',
    tint: 'danger',
    label: () => en.event.type.SAFETY_EQUIPMENT,
    odometer: 'optional',
    validity: 'untilRequired',
    details: 'SAFETY_EQUIPMENT',
    customLabel: false,
    defaultComponents: [],
    documentHint: () => en.event.documentHint.SAFETY_EQUIPMENT,
  },
  OTHER: {
    icon: 'sparkle',
    tint: 'ink-muted',
    label: () => en.event.type.OTHER,
    odometer: 'optional',
    validity: 'none',
    details: null,
    customLabel: true,
    defaultComponents: [],
    documentHint: null,
  },
};

/** The title of an entry: a custom label, a scan's service name, the insurer, the safety item, else the label of the type. */
export function eventTitle(e: EventResponse): string {
  const config = EVENT_TYPE_CONFIG[e.type];
  if (config.customLabel && e.customLabel) return e.customLabel;
  const details = e.details;
  if (details?.kind === 'SCAN' && details.serviceName) return details.serviceName;
  if (details?.kind === 'INSURANCE') return `${details.coverage} · ${details.insurer}`;
  if (details?.kind === 'SAFETY_EQUIPMENT') return en.event.safetyItem[details.item];
  return config.label();
}

/** `148200` as `148 200`. */
function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 1250 as `1 250`, with at most two decimals. */
function amount(n: number): string {
  const [whole, fraction] = String(Math.round(n * 100) / 100).split('.');
  return groupThousands(Number(whole)) + (fraction ? `.${fraction}` : '');
}

/** What a row says under its title: until when and cost for validity types, else kilometres (when known) and cost. */
export function eventSubtitle(e: EventResponse): string {
  const cost = `${amount(e.costAmount)} ${e.currency}`;
  const config = EVENT_TYPE_CONFIG[e.type];
  if (config.validity !== 'none' && e.validUntil) return `${en.event.until(formatDate(e.validUntil))} · ${cost}`;
  return e.odometerKm === null ? cost : `${groupThousands(e.odometerKm)} km · ${cost}`;
}
