/* Fake handlers for the fuel operations. Stats follow the backend rules in a simplified way; a test can pin the exact
   answer with `state.fuelStats[vin]` (alert, grade comparison and other cases the simple maths does not produce). */
import type { components } from '@/shared/api/generated/schema';
import type { Ctx, FakeState, Handler, Reply } from './handlers';

type Schemas = components['schemas'];
export type FuelEntryResponse = Schemas['FuelEntryResponse'];
export type FuelStatsResponse = Schemas['FuelStatsResponse'];
type FuelRequest = Schemas['FuelEntryRequest'];

const PROBLEM = 'application/problem+json';
const uuid = () => globalThis.crypto.randomUUID();
const today = () => new Date().toISOString().slice(0, 10);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function problem(status: number, code: string): Reply {
  return {
    status,
    contentType: PROBLEM,
    body: { type: `urn:vehicle-passport:${code}`, title: code, status, detail: code, code },
  };
}

export function aFuelEntry(o: Partial<FuelEntryResponse> = {}): FuelEntryResponse {
  return {
    id: uuid(),
    date: '2026-10-01',
    odometerKm: 10_000,
    fuelType: 'DIESEL',
    quantity: 40,
    unit: 'L',
    total: 300,
    unitPrice: 7.5,
    currency: 'RON',
    fullTank: true,
    missedPrevious: false,
    grade: null,
    chargeType: null,
    station: null,
    note: null,
    consumption: null,
    ...o,
  };
}

export function aFuelStats(o: Partial<FuelStatsResponse> = {}): FuelStatsResponse {
  return {
    currency: null,
    period: { from: null, to: null },
    lastOdometerKm: null,
    entryCount: 0,
    ignoredEntries: 0,
    totalCost: 0,
    costPerKm: null,
    monthly: [],
    monthEstimate: { month: today().slice(0, 7), spentSoFar: 0, projected: null },
    byFuelType: [],
    ...o,
  };
}

const ordered = (list: FuelEntryResponse[]) =>
  [...list].sort((a, b) => (a.date === b.date ? a.odometerKm - b.odometerKm : a.date < b.date ? -1 : 1));

/** Consumption (per 100 km) on every full fill-up that closes an included segment, keyed by entry id. */
function consumptions(entries: FuelEntryResponse[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const type of new Set(entries.map((e) => e.fuelType))) {
    let anchor: FuelEntryResponse | null = null;
    let quantity = 0;
    let missed = false;
    for (const e of ordered(entries.filter((x) => x.fuelType === type))) {
      if (anchor) {
        quantity += e.quantity;
        missed = missed || e.missedPrevious;
      }
      if (!e.fullTank) continue;
      if (anchor) {
        const km = e.odometerKm - anchor.odometerKm;
        if (!missed && km >= 20) out.set(e.id, round((quantity / km) * 100, 2));
      }
      anchor = e;
      quantity = 0;
      missed = false;
    }
  }
  return out;
}

function withConsumption(entries: FuelEntryResponse[]): FuelEntryResponse[] {
  const c = consumptions(entries);
  return entries.map((e) => ({ ...e, consumption: c.get(e.id) ?? null }));
}

function buildStats(state: FakeState, vin: string, period: string): FuelStatsResponse {
  const pinned = state.fuelStats[vin];
  if (pinned) return pinned;
  const all = ordered(state.fuel[vin] ?? []);
  if (all.length === 0) return aFuelStats();
  const c = consumptions(all);
  const byType = [...new Set(all.map((e) => e.fuelType))].map((fuelType) => {
    const list = all.filter((e) => e.fuelType === fuelType);
    const values = list.map((e) => c.get(e.id)).filter((v): v is number => v !== undefined);
    return {
      fuelType,
      unit: list[0].unit,
      avgConsumption: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 2) : null,
      lastConsumption: values.length ? values[values.length - 1] : null,
      avgUnitPrice: round(list.reduce((a, e) => a + e.total, 0) / list.reduce((a, e) => a + e.quantity, 0), 4),
      segmentCount: values.length,
      points: list.map((e) => ({
        entryId: e.id,
        date: e.date,
        odometerKm: e.odometerKm,
        unitPrice: e.unitPrice,
        consumption: c.get(e.id) ?? null,
      })),
      alert: null,
      gradeComparison: [],
    };
  });
  const months = new Map<string, { cost: number; quantity: number; entries: number }>();
  for (const e of all) {
    const m = months.get(e.date.slice(0, 7)) ?? { cost: 0, quantity: 0, entries: 0 };
    months.set(e.date.slice(0, 7), { cost: m.cost + e.total, quantity: m.quantity + e.quantity, entries: m.entries + 1 });
  }
  const month = today().slice(0, 7);
  const first = all[0];
  const last = all[all.length - 1];
  const span = last.odometerKm - first.odometerKm;
  return aFuelStats({
    currency: last.currency,
    period: { from: period === 'all' ? null : first.date, to: last.date },
    lastOdometerKm: Math.max(...all.map((e) => e.odometerKm)),
    entryCount: all.length,
    totalCost: round(all.reduce((a, e) => a + e.total, 0), 2),
    costPerKm: all.length >= 2 && span > 0 ? round(all.slice(1).reduce((a, e) => a + e.total, 0) / span, 4) : null,
    monthly: [...months.entries()].map(([m, v]) => ({ month: m, cost: round(v.cost, 2), quantity: v.quantity, entries: v.entries, distanceKm: null })),
    monthEstimate: { month, spentSoFar: round(months.get(month)?.cost ?? 0, 2), projected: null },
    byFuelType: byType,
  });
}

function owned(c: Ctx): boolean {
  return c.state.vehicles.some((v) => v.vin === c.params.vin);
}

const toEntry = (b: FuelRequest, id: string): FuelEntryResponse => ({
  id,
  date: b.date,
  odometerKm: b.odometerKm,
  fuelType: b.fuelType,
  quantity: b.quantity,
  unit: b.fuelType === 'ELECTRIC' ? 'KWH' : 'L',
  total: b.total,
  unitPrice: round(b.total / b.quantity, 4),
  currency: b.currency,
  fullTank: b.fullTank ?? true,
  missedPrevious: b.missedPrevious ?? false,
  grade: b.grade ?? null,
  chargeType: b.chargeType ?? null,
  station: b.station ?? null,
  note: b.note ?? null,
  consumption: null,
});

/** Mirrors the server: neighbours by (date, km) may not contradict the new reading. */
function refused(list: FuelEntryResponse[], b: FuelRequest, exceptId?: string): Reply | null {
  const vehicleFuel = b.fuelType;
  if (b.date > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) return problem(422, 'invalid-fuel-entry');
  if (b.grade && vehicleFuel === 'ELECTRIC') return problem(422, 'invalid-fuel-entry');
  if (b.chargeType && vehicleFuel !== 'ELECTRIC') return problem(422, 'invalid-fuel-entry');
  const others = list.filter((e) => e.id !== exceptId);
  const fits = others.every((e) => e.date === b.date || (e.date < b.date ? e.odometerKm <= b.odometerKm : e.odometerKm >= b.odometerKm));
  return fits ? null : problem(422, 'odometer-inconsistent');
}

const addFuelEntry: Handler = (c) => {
  if (!owned(c)) return problem(404, 'vehicle-not-found');
  const list = (c.state.fuel[c.params.vin] ??= []);
  const b = c.body as FuelRequest;
  const car = c.state.vehicles.find((v) => v.vin === c.params.vin)!;
  if ((car.fuel === 'ELECTRIC') !== (b.fuelType === 'ELECTRIC') && car.fuel !== 'HYBRID' && car.fuel !== 'OTHER') {
    return problem(422, 'invalid-fuel-entry');
  }
  const refusal = refused(list, b);
  if (refusal) return refusal;
  const entry = toEntry(b, uuid());
  list.push(entry);
  return { status: 201, body: withConsumption(list).find((e) => e.id === entry.id) };
};

const listFuelEntries: Handler = (c) => {
  if (!owned(c)) return problem(404, 'vehicle-not-found');
  const limitParam = c.query.get('limit');
  const limit = limitParam === null ? 30 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return problem(400, 'validation-failed');
  const cursor = c.query.get('cursor');
  let offset = 0;
  if (cursor !== null) {
    if (!/^c[0-9a-z]+$/.test(cursor)) return problem(400, 'validation-failed');
    offset = parseInt(cursor.slice(1), 36);
  }
  const newestFirst = withConsumption(ordered(c.state.fuel[c.params.vin] ?? [])).reverse();
  if (offset > newestFirst.length) return problem(400, 'validation-failed');
  const end = offset + limit;
  return { status: 200, body: { items: newestFirst.slice(offset, end), nextCursor: end < newestFirst.length ? `c${end.toString(36)}` : null } };
};

const updateFuelEntry: Handler = (c) => {
  if (!owned(c)) return problem(404, 'vehicle-not-found');
  const list = c.state.fuel[c.params.vin] ?? [];
  const existing = list.find((e) => e.id === c.params.entryId);
  if (!existing) return problem(404, 'fuel-entry-not-found');
  const b = c.body as FuelRequest;
  const refusal = refused(list, b, existing.id);
  if (refusal) return refusal;
  Object.assign(existing, toEntry(b, existing.id));
  return { status: 200, body: withConsumption(list).find((e) => e.id === existing.id) };
};

const deleteFuelEntry: Handler = (c) => {
  if (!owned(c)) return problem(404, 'vehicle-not-found');
  const list = c.state.fuel[c.params.vin] ?? [];
  if (!list.some((e) => e.id === c.params.entryId)) return problem(404, 'fuel-entry-not-found');
  c.state.fuel[c.params.vin] = list.filter((e) => e.id !== c.params.entryId);
  return { status: 204 };
};

const getFuelStats: Handler = (c) => {
  if (!owned(c)) return problem(404, 'vehicle-not-found');
  const period = c.query.get('period') ?? '6m';
  if (!['3m', '6m', '12m', 'all'].includes(period)) return problem(400, 'validation-failed');
  return { status: 200, body: buildStats(c.state, c.params.vin, period) };
};

export const fuelHandlers: Record<string, Handler> = {
  addFuelEntry,
  listFuelEntries,
  updateFuelEntry,
  deleteFuelEntry,
  getFuelStats,
};
