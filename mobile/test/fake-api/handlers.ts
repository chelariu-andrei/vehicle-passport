/* One handler per authenticated operation, mirroring the server behaviour the integration spec marks (server). */
import type { components } from '@/shared/api/generated/schema';
import type { EventResponse, PassportResponse, PendingClaimResponse, ScanJobResponse, VehicleResponse } from './builders';

type Schemas = components['schemas'];

export interface FakeState {
  vehicles: VehicleResponse[];
  events: Record<string, EventResponse[]>;
  claims: Record<string, PendingClaimResponse[]>;
  otherOwnerVins: Set<string>;
  scans: Record<string, ScanJobResponse>;
  passports: PassportResponse[];
}

export interface Reply {
  status: number;
  body?: unknown;
  contentType?: string;
  bytes?: Uint8Array;
}

export interface Ctx {
  state: FakeState;
  /** Which car each scan job was uploaded for. */
  scanVins: Map<string, string>;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Parsed JSON body, or undefined when the request had none. */
  body: any;
  form: UploadForm | null;
}

/** The slice of FormData the handlers read; the app and DOM typings of FormData differ. */
export interface UploadForm {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}

export type Handler = (c: Ctx) => Reply | Promise<Reply>;

export const MAX_UPLOAD_BYTES = 10_485_760;
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const PROBLEM = 'application/problem+json';

export function problem(status: number, code: string): Reply {
  return {
    status,
    contentType: PROBLEM,
    body: { type: `urn:vehicle-passport:${code}`, title: code, status, detail: code, code },
  };
}

const ok = (body: unknown, status = 200): Reply => ({ status, body });
const noContent = (): Reply => ({ status: 204 });
const today = () => new Date().toISOString().slice(0, 10);
const uuid = () => globalThis.crypto.randomUUID();

function ownedVehicle(c: Ctx): VehicleResponse | undefined {
  return c.state.vehicles.find((v) => v.vin === c.params.vin);
}

const notOwned = () => problem(404, 'vehicle-not-found');

function yearInRange(year: number): boolean {
  return year >= 1886 && year <= new Date().getUTCFullYear() + 1;
}

/** An entry fits when nothing earlier has more kilometres and nothing later has fewer. */
function odometerFits(events: EventResponse[], date: string, km: number, exceptId?: string): boolean {
  return events.every(
    (e) => e.id === exceptId || e.date === date || (e.date < date ? e.odometerKm <= km : e.odometerKm >= km),
  );
}

function checkEventRules(events: EventResponse[], date: string, km: number, exceptId?: string): Reply | null {
  if (date > today()) return problem(422, 'invalid-event');
  if (!odometerFits(events, date, km, exceptId)) return problem(422, 'odometer-inconsistent');
  return null;
}

function claimsOf(state: FakeState): [string, PendingClaimResponse][] {
  return Object.entries(state.claims).flatMap(([vin, list]) => list.map((c): [string, PendingClaimResponse] => [vin, c]));
}

function checkFile(value: unknown): Reply | null {
  const file = value as Blob | string | null;
  if (!file || typeof file === 'string') return problem(400, 'validation-failed');
  if (file.size > MAX_UPLOAD_BYTES) return problem(413, 'file-too-large');
  if (!UPLOAD_TYPES.includes(file.type)) return problem(415, 'unsupported-file');
  return null;
}

const newJob = (): ScanJobResponse => ({ id: uuid(), status: 'PENDING', fields: null, warnings: [] });

const registerVehicle: Handler = (c) => {
  const b = c.body as Schemas['RegisterVehicleRequest'];
  if (!yearInRange(b.year)) return problem(400, 'invalid-vehicle');
  if (c.state.vehicles.some((v) => v.vin === b.vin)) return problem(409, 'already-owner');
  if (c.state.otherOwnerVins.has(b.vin)) {
    const claim: PendingClaimResponse = { claimId: uuid(), filedAt: new Date().toISOString() };
    (c.state.claims[b.vin] ??= []).push(claim);
    return ok(claim, 202);
  }
  const vehicle: VehicleResponse = { vin: b.vin, make: b.make, model: b.model, engine: b.engine ?? null, year: b.year, fuel: b.fuel };
  c.state.vehicles.push(vehicle);
  return ok(vehicle, 201);
};

const listMyVehicles: Handler = (c) => ok(c.state.vehicles);

const getVehicle: Handler = (c) => {
  const vehicle = ownedVehicle(c);
  return vehicle ? ok(vehicle) : notOwned();
};

const updateVehicle: Handler = (c) => {
  const vehicle = ownedVehicle(c);
  if (!vehicle) return notOwned();
  const b = c.body as Schemas['UpdateVehicleRequest'];
  if (b.year !== undefined && !yearInRange(b.year)) return problem(400, 'invalid-vehicle');
  Object.assign(vehicle, b);
  return ok(vehicle);
};

const releaseVehicle: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  c.state.vehicles = c.state.vehicles.filter((v) => v.vin !== c.params.vin);
  delete c.state.claims[c.params.vin];
  return noContent();
};

const listPendingClaims: Handler = (c) => (ownedVehicle(c) ? ok(c.state.claims[c.params.vin] ?? []) : notOwned());

const decideClaim = (approve: boolean): Handler => (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const pending = c.state.claims[c.params.vin] ?? [];
  if (!pending.some((claim) => claim.claimId === c.params.claimId)) return problem(404, 'claim-not-found');
  if (approve) {
    c.state.vehicles = c.state.vehicles.filter((v) => v.vin !== c.params.vin);
    delete c.state.claims[c.params.vin];
  } else {
    c.state.claims[c.params.vin] = pending.filter((claim) => claim.claimId !== c.params.claimId);
  }
  return noContent();
};

const withdrawClaim: Handler = (c) => {
  const found = claimsOf(c.state).find(([, claim]) => claim.claimId === c.params.claimId);
  if (!found) return problem(404, 'claim-not-found');
  c.state.claims[found[0]] = c.state.claims[found[0]].filter((claim) => claim.claimId !== c.params.claimId);
  return noContent();
};

const addEvent: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const b = c.body as Schemas['EventRequest'];
  const events = (c.state.events[c.params.vin] ??= []);
  const refused = checkEventRules(events, b.date, b.odometerKm, undefined);
  if (refused) return refused;
  const event: EventResponse = {
    id: uuid(),
    type: b.type,
    date: b.date,
    odometerKm: b.odometerKm,
    costAmount: b.costAmount,
    currency: b.currency,
    notes: b.notes ?? null,
    details: null,
    evidence: 'USER_CONFIRMED',
    source: 'MANUAL',
    documentPresent: false,
  };
  events.push(event);
  return ok(event, 201);
};

const updateEvent: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const events = c.state.events[c.params.vin] ?? [];
  const event = events.find((e) => e.id === c.params.eventId);
  if (!event) return problem(404, 'event-not-found');
  const b = c.body as Schemas['EventRequest'];
  if (event.evidence === 'DOCUMENTED') {
    const unchanged =
      b.type === event.type &&
      b.date === event.date &&
      b.odometerKm === event.odometerKm &&
      b.costAmount === event.costAmount &&
      b.currency === event.currency;
    if (!unchanged) return problem(422, 'documented-event-immutable');
  } else {
    const refused = checkEventRules(events, b.date, b.odometerKm, event.id);
    if (refused) return refused;
  }
  Object.assign(event, { ...b, notes: b.notes ?? null });
  return ok(event);
};

const deleteEvent: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const events = c.state.events[c.params.vin] ?? [];
  if (!events.some((e) => e.id === c.params.eventId)) return problem(404, 'event-not-found');
  c.state.events[c.params.vin] = events.filter((e) => e.id !== c.params.eventId);
  return noContent();
};

const getEventDocument: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const event = (c.state.events[c.params.vin] ?? []).find((e) => e.id === c.params.eventId);
  if (!event?.documentPresent) return problem(404, 'event-not-found');
  return { status: 200, contentType: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) };
};

const getTimeline: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const limitParam = c.query.get('limit');
  const limit = limitParam === null ? 20 : Number(limitParam);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return problem(400, 'validation-failed');
  const cursor = c.query.get('cursor');
  let offset = 0;
  if (cursor !== null) {
    if (!/^c[0-9a-z]+$/.test(cursor)) return problem(400, 'invalid-cursor');
    offset = parseInt(cursor.slice(1), 36);
  }
  const ordered = (c.state.events[c.params.vin] ?? [])
    .map((event, index) => ({ event, index }))
    .sort((a, b) => (a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : a.index - b.index))
    .map((entry) => entry.event);
  if (offset > ordered.length) return problem(400, 'invalid-cursor');
  const end = offset + limit;
  return ok({ items: ordered.slice(offset, end), nextCursor: end < ordered.length ? `c${end.toString(36)}` : null });
};

const submitScan: Handler = (c) => {
  const vehicle = ownedVehicle(c);
  if (!vehicle) return notOwned();
  const refused = checkFile(c.form?.get('file') ?? null);
  if (refused) return refused;
  const job = newJob();
  c.state.scans[job.id] = job;
  c.scanVins.set(job.id, vehicle.vin);
  return ok(job, 202);
};

const submitScanBatch: Handler = (c) => {
  const vehicle = ownedVehicle(c);
  if (!vehicle) return notOwned();
  const files = c.form?.getAll('files') ?? [];
  if (files.length === 0) return problem(400, 'validation-failed');
  if (files.length > 20) return problem(422, 'batch-too-large');
  for (const file of files) {
    const refused = checkFile(file);
    if (refused) return refused;
  }
  const jobs = files.map(() => {
    const job = newJob();
    c.state.scans[job.id] = job;
    c.scanVins.set(job.id, vehicle.vin);
    return job;
  });
  return ok({ jobs }, 202);
};

const getScan: Handler = (c) => {
  const job = c.state.scans[c.params.jobId];
  return job ? ok(job) : problem(404, 'scan-not-found');
};

const confirmScan: Handler = (c) => {
  const job = c.state.scans[c.params.jobId];
  if (!job) return problem(404, 'scan-not-found');
  if (job.status !== 'EXTRACTED') return problem(409, 'scan-state-conflict');
  const vin = c.scanVins.get(job.id) ?? c.state.vehicles[0]?.vin;
  if (!vin) return problem(409, 'scan-state-conflict');
  const b = c.body as Schemas['ConfirmScanRequest'];
  const events = (c.state.events[vin] ??= []);
  const refused = checkEventRules(events, b.date, b.odometerKm);
  if (refused) return refused;
  const event: EventResponse = {
    id: uuid(),
    type: b.type ?? 'SERVICE',
    date: b.date,
    odometerKm: b.odometerKm,
    costAmount: b.total,
    currency: b.currency ?? 'RON',
    notes: b.notes ?? null,
    details: { serviceName: b.serviceName ?? null, parts: b.parts ?? [], labor: b.labor ?? null },
    evidence: 'DOCUMENTED',
    source: 'SCAN',
    documentPresent: true,
  };
  events.push(event);
  job.status = 'CONFIRMED';
  return ok({ eventId: event.id }, 201);
};

const rejectScan: Handler = (c) => {
  const job = c.state.scans[c.params.jobId];
  if (!job) return problem(404, 'scan-not-found');
  if (job.status === 'CONFIRMED' || job.status === 'REJECTED' || job.status === 'CANCELLED') {
    return problem(409, 'scan-state-conflict');
  }
  job.status = 'REJECTED';
  return noContent();
};

const createPassport: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const expiresAt: string | null = c.body?.expiresAt ?? null;
  if (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) return problem(422, 'expiry-in-past');
  const id = uuid();
  const passport: PassportResponse = {
    id,
    vin: c.params.vin,
    publicUrl: `https://passports.example.com/public/passports/${id.replaceAll('-', '')}`,
    hash: Array.from({ length: 8 }, () => uuid().replaceAll('-', '').slice(0, 8)).join(''),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt,
  };
  c.state.passports.push(passport);
  return ok(passport, 201);
};

/** Newest first; passports made in the same millisecond keep the later one first. */
const listMyPassports: Handler = (c) =>
  ok(
    c.state.passports
      .map((passport, index) => ({ passport, index }))
      .sort((a, b) => (a.passport.createdAt < b.passport.createdAt ? 1 : a.passport.createdAt > b.passport.createdAt ? -1 : b.index - a.index))
      .map((entry) => entry.passport),
  );

const withPassport = (use: (p: PassportResponse, c: Ctx) => Reply): Handler => (c) => {
  const passport = c.state.passports.find((p) => p.id === c.params.id);
  return passport ? use(passport, c) : problem(404, 'passport-not-found');
};

const revokePassport = withPassport((p) => {
  p.status = 'REVOKED';
  return noContent();
});

const getPassportPdf = withPassport(() => ({
  status: 200,
  contentType: 'application/pdf',
  bytes: new TextEncoder().encode('%PDF-1.4\n%%EOF\n'),
}));

const getPassportQr = withPassport(() => ({
  status: 200,
  contentType: 'image/png',
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
}));

export const handlers: Record<string, Handler> = {
  registerVehicle,
  listMyVehicles,
  getVehicle,
  updateVehicle,
  releaseVehicle,
  listPendingClaims,
  approveClaim: decideClaim(true),
  rejectClaim: decideClaim(false),
  withdrawClaim,
  addEvent,
  updateEvent,
  deleteEvent,
  getEventDocument,
  getTimeline,
  submitScan,
  submitScanBatch,
  getScan,
  confirmScan,
  rejectScan,
  createPassport,
  listMyPassports,
  revokePassport,
  getPassportPdf,
  getPassportQr,
};
