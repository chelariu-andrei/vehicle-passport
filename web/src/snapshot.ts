export type Part = { name: string; qty: number | null; price: string | null };

export type CustomField = { label: string; value: string };

export type EventDetails =
  | { kind: 'INSURANCE'; coverage: 'RCA' | 'CASCO'; insurer: string; policyNumber: string | null }
  | { kind: 'ROVINIETA'; duration: string }
  | { kind: 'ITP'; station: string | null; result: string | null }
  | { kind: 'SAFETY_EQUIPMENT'; item: 'FIRE_EXTINGUISHER' | 'FIRST_AID_KIT' };

export type SnapshotEvent = {
  type: string;
  date: string | null;
  odometerKm: number | null;
  costAmount: string | null;
  currency: string | null;
  notes: string | null;
  serviceName: string | null;
  parts: Part[] | null;
  labor: string | null;
  evidence: string;
  documentPresent: boolean;
  customLabel: string | null;
  validFrom: string | null;
  validUntil: string | null;
  details: EventDetails | null;
  components: string[];
  customFields: CustomField[];
};

export type Vehicle = {
  vin: string;
  make: string | null;
  model: string | null;
  engine: string | null;
  year: number | null;
  fuel: string | null;
};

export type Snapshot = { vehicle: Vehicle; events: SnapshotEvent[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parsePart(raw: unknown): Part | null {
  if (!isObject(raw)) return null;
  return { name: text(raw.name) ?? '', qty: num(raw.qty), price: text(raw.price) };
}

function parseDetails(raw: unknown): EventDetails | null {
  if (!isObject(raw)) return null;
  switch (raw.kind) {
    case 'INSURANCE': {
      const coverage = raw.coverage;
      if (coverage !== 'RCA' && coverage !== 'CASCO') return null;
      return { kind: 'INSURANCE', coverage, insurer: text(raw.insurer) ?? '', policyNumber: text(raw.policyNumber) };
    }
    case 'ROVINIETA':
      return { kind: 'ROVINIETA', duration: text(raw.duration) ?? '' };
    case 'ITP':
      return { kind: 'ITP', station: text(raw.station), result: text(raw.result) };
    case 'SAFETY_EQUIPMENT':
      return raw.item === 'FIRE_EXTINGUISHER' || raw.item === 'FIRST_AID_KIT'
        ? { kind: 'SAFETY_EQUIPMENT', item: raw.item }
        : null;
    default:
      return null; // scan details stay flat on the event; unknown kinds are ignored
  }
}

function parseCustomField(raw: unknown): CustomField | null {
  if (!isObject(raw)) return null;
  const label = text(raw.label);
  const value = text(raw.value);
  return label === null || value === null ? null : { label, value };
}

function parseEvent(raw: unknown): SnapshotEvent | null {
  if (!isObject(raw)) return null;
  const evidence = text(raw.evidence);
  const type = text(raw.type);
  if (!evidence || !type) return null;
  const parts = Array.isArray(raw.parts)
    ? raw.parts.map(parsePart).filter((p): p is Part => p !== null)
    : null;
  return {
    type,
    date: text(raw.date),
    odometerKm: num(raw.odometerKm),
    costAmount: text(raw.costAmount),
    currency: text(raw.currency),
    notes: text(raw.notes),
    serviceName: text(raw.serviceName),
    parts,
    labor: text(raw.labor),
    evidence,
    documentPresent: raw.documentPresent === true,
    customLabel: text(raw.customLabel),
    validFrom: text(raw.validFrom),
    validUntil: text(raw.validUntil),
    details: parseDetails(raw.details),
    components: Array.isArray(raw.components) ? raw.components.filter((c): c is string => typeof c === 'string') : [],
    customFields: Array.isArray(raw.customFields)
      ? raw.customFields.map(parseCustomField).filter((f): f is CustomField => f !== null)
      : [],
  };
}

/** Returns null when the snapshot is not shaped as the contract describes. */
export function parseSnapshot(raw: unknown): Snapshot | null {
  if (!isObject(raw) || !isObject(raw.vehicle) || !Array.isArray(raw.events)) return null;
  const vin = text(raw.vehicle.vin);
  if (!vin) return null;
  const events: SnapshotEvent[] = [];
  for (const item of raw.events) {
    const event = parseEvent(item);
    if (!event) return null;
    events.push(event);
  }
  return {
    vehicle: {
      vin,
      make: text(raw.vehicle.make),
      model: text(raw.vehicle.model),
      engine: text(raw.vehicle.engine),
      year: num(raw.vehicle.year),
      fuel: text(raw.vehicle.fuel),
    },
    events,
  };
}
