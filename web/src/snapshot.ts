export type Part = { name: string; qty: number | null; price: string | null };

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
