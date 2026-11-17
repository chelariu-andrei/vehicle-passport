/* One handler per authenticated operation, mirroring the server behaviour the integration spec marks (server). */
import { daysBetween, rovinietaEnd } from '@/features/event/model/validity';
import type { components } from '@/shared/api/generated/schema';
import { accountHandlers, type AccountState } from './account';
import type { AttachmentResponse, EventResponse, PassportResponse, PendingClaimResponse, ScanJobResponse, VehicleResponse } from './builders';

type Schemas = components['schemas'];

export interface FakeState {
  vehicles: VehicleResponse[];
  events: Record<string, EventResponse[]>;
  claims: Record<string, PendingClaimResponse[]>;
  otherOwnerVins: Set<string>;
  scans: Record<string, ScanJobResponse>;
  passports: PassportResponse[];
  /** Attachments by event id. */
  attachments: Record<string, AttachmentResponse[]>;
  account: AccountState;
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
  /** Ids of claims that were approved, rejected, withdrawn or closed by the car leaving; `state.claims` holds only pending ones. */
  decidedClaims: Set<string>;
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
function odometerFits(events: EventResponse[], date: string, km: number | null | undefined, exceptId?: string): boolean {
  if (km === null || km === undefined) return true;
  return events.every(
    (e) => e.id === exceptId || e.odometerKm === null || e.date === date || (e.date < date ? e.odometerKm <= km : e.odometerKm >= km),
  );
}

function checkEventRules(events: EventResponse[], date: string, km: number | null | undefined, exceptId?: string): Reply | null {
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
  const vehicle: VehicleResponse = { vin: b.vin, make: b.make, model: b.model, engine: b.engine ?? null, year: b.year, fuel: b.fuel, plate: null, appearance: null };
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

/** The car leaves the garage: its pending claims are decided and its unconfirmed scans are cancelled. */
function endOwnership(c: Ctx, vin: string): void {
  c.state.vehicles = c.state.vehicles.filter((v) => v.vin !== vin);
  for (const claim of c.state.claims[vin] ?? []) c.decidedClaims.add(claim.claimId);
  delete c.state.claims[vin];
  for (const [jobId, jobVin] of c.scanVins) {
    const job = c.state.scans[jobId];
    if (jobVin === vin && job && job.status !== 'CONFIRMED' && job.status !== 'REJECTED') job.status = 'CANCELLED';
  }
}

const releaseVehicle: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  endOwnership(c, c.params.vin);
  return noContent();
};

const listPendingClaims: Handler = (c) =>
  ownedVehicle(c)
    ? ok((c.state.claims[c.params.vin] ?? []).map(({ claimId, filedAt }) => ({ claimId, filedAt })))
    : notOwned();

const decideClaim = (approve: boolean): Handler => (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const pending = c.state.claims[c.params.vin] ?? [];
  if (!pending.some((claim) => claim.claimId === c.params.claimId)) {
    return problem(c.decidedClaims.has(c.params.claimId) ? 409 : 404, c.decidedClaims.has(c.params.claimId) ? 'claim-not-pending' : 'claim-not-found');
  }
  if (approve) {
    endOwnership(c, c.params.vin);
  } else {
    c.decidedClaims.add(c.params.claimId);
    c.state.claims[c.params.vin] = pending.filter((claim) => claim.claimId !== c.params.claimId);
  }
  return noContent();
};

const withdrawClaim: Handler = (c) => {
  const found = claimsOf(c.state).find(([, claim]) => claim.claimId === c.params.claimId);
  if (!found) return c.decidedClaims.has(c.params.claimId) ? problem(409, 'claim-not-pending') : problem(404, 'claim-not-found');
  c.decidedClaims.add(c.params.claimId);
  c.state.claims[found[0]] = c.state.claims[found[0]].filter((claim) => claim.claimId !== c.params.claimId);
  return noContent();
};

/** A rovinieta's end is computed from its start and duration, as the server does; every other type sends it. */
function validUntilOf(b: Schemas['EventRequest']): string | null {
  const details = b.details as { duration?: Parameters<typeof rovinietaEnd>[1] } | null | undefined;
  if (b.type === 'ROVINIETA' && details?.duration && b.validFrom) return rovinietaEnd(b.validFrom, details.duration);
  return b.validUntil ?? null;
}

const EXPIRING_DAYS = 30;

/** Entries of one kind of document (a RCA policy, an ITP, ...) replace each other; null for types without validity. */
function validityGroup(e: EventResponse): string | null {
  const details = e.details as { coverage?: string; item?: string } | null;
  switch (e.type) {
    case 'ITP':
    case 'ROVINIETA':
      return e.type;
    case 'INSURANCE':
      return details?.coverage ?? 'RCA';
    case 'SAFETY_EQUIPMENT':
      return details?.item ?? 'FIRE_EXTINGUISHER';
    default:
      return null;
  }
}

/** The events with `validityStatus`: the newest of each group gets a live status, the older ones are SUPERSEDED. Does not touch the state. */
function withValidity(events: EventResponse[]): EventResponse[] {
  const newest = new Map<string, EventResponse>();
  events.forEach((e) => {
    const group = validityGroup(e);
    const current = group === null ? undefined : newest.get(group);
    if (group !== null && (!current || e.date >= current.date)) newest.set(group, e);
  });
  return events.map((e) => {
    const group = validityGroup(e);
    if (group === null) return e;
    if (newest.get(group) !== e) return { ...e, validityStatus: 'SUPERSEDED' as const };
    if (!e.validUntil) return { ...e, validityStatus: 'UNKNOWN' as const };
    const days = daysBetween(today(), e.validUntil);
    return { ...e, validityStatus: days < 0 ? ('EXPIRED' as const) : days <= EXPIRING_DAYS ? ('EXPIRING' as const) : ('VALID' as const) };
  });
}

const EVENT_TYPES = ['SERVICE', 'REPAIR', 'TIRES', 'ITP', 'ROVINIETA', 'INSURANCE', 'SAFETY_EQUIPMENT', 'OTHER'];
const COMPONENT_NAMES = [
  'ENGINE', 'TRANSMISSION', 'BRAKES', 'SUSPENSION', 'STEERING', 'TIRES_WHEELS', 'ELECTRICAL', 'CLIMATE', 'BODY', 'EXHAUST', 'INTERIOR', 'FLUIDS', 'OTHER',
];

interface Filters {
  types: string[];
  components: string[];
  from: string | null;
  to: string | null;
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The type, component, from and to filters of a request, or the problem to answer. */
function filtersOf(c: Ctx): Filters | Reply {
  const types = c.query.getAll('type');
  const components = c.query.getAll('component');
  const from = c.query.get('from');
  const to = c.query.get('to');
  const bad =
    types.some((t) => !EVENT_TYPES.includes(t)) ||
    components.some((t) => !COMPONENT_NAMES.includes(t)) ||
    (from !== null && !isDate(from)) ||
    (to !== null && !isDate(to)) ||
    (from !== null && to !== null && from > to);
  return bad ? problem(400, 'validation-failed') : { types, components, from, to };
}

const isReply = (f: Filters | Reply): f is Reply => 'status' in f;

function matches(e: EventResponse, f: Filters): boolean {
  return (
    (f.types.length === 0 || f.types.includes(e.type)) &&
    (f.components.length === 0 || e.components.some((x) => f.components.includes(x))) &&
    (f.from === null || e.date >= f.from) &&
    (f.to === null || e.date <= f.to)
  );
}

/** Oldest first; entries of the same day keep their insertion order. */
function chronological(events: EventResponse[]): EventResponse[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => (a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : a.index - b.index))
    .map((entry) => entry.event);
}

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
    odometerKm: b.odometerKm ?? null,
    costAmount: b.costAmount,
    currency: b.currency,
    notes: b.notes ?? null,
    customLabel: b.customLabel ?? null,
    validFrom: b.validFrom ?? null,
    validUntil: validUntilOf(b),
    details: (b.details ?? null) as EventResponse['details'],
    components: b.components ?? [],
    customFields: b.customFields ?? [],
    evidence: 'USER_CONFIRMED',
    source: 'MANUAL',
    documentPresent: false,
    attachmentCount: 0,
  };
  events.push(event);
  return ok(withValidity(events).find((e) => e.id === event.id), 201);
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
  Object.assign(event, {
    ...b,
    notes: b.notes ?? null,
    customLabel: b.customLabel ?? null,
    validFrom: b.validFrom ?? null,
    validUntil: validUntilOf(b),
    details: (b.details ?? null) as EventResponse['details'],
    components: b.components ?? [],
    customFields: b.customFields ?? [],
  });
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

export const MAX_ATTACHMENTS = 10;

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** The vehicle and event of the path, or the problem to answer. */
function eventOf(c: Ctx): { event: EventResponse } | { refused: Reply } {
  if (!ownedVehicle(c)) return { refused: notOwned() };
  const event = (c.state.events[c.params.vin] ?? []).find((e) => e.id === c.params.eventId);
  return event ? { event } : { refused: problem(404, 'event-not-found') };
}

const addAttachment: Handler = async (c) => {
  const found = eventOf(c);
  if ('refused' in found) return found.refused;
  const { event } = found;
  const value = c.form?.get('file') ?? null;
  const refused = checkFile(value);
  if (refused) return refused;
  const file = value as Blob;
  const list = (c.state.attachments[event.id] ??= []);
  if (list.length >= MAX_ATTACHMENTS) return problem(422, 'attachment-limit');
  const sha256 = await sha256Hex(file);
  const vehicleEvents = c.state.events[c.params.vin] ?? [];
  if (vehicleEvents.some((e) => (c.state.attachments[e.id] ?? []).some((a) => a.sha256 === sha256))) {
    return problem(409, 'duplicate-document');
  }
  const attachment: AttachmentResponse = {
    id: uuid(),
    contentType: file.type,
    sizeBytes: file.size,
    sha256,
    kind: 'UPLOAD',
    createdAt: new Date().toISOString(),
  };
  list.push(attachment);
  event.attachmentCount = list.length;
  return ok(attachment, 201);
};

const listAttachments: Handler = (c) => {
  const found = eventOf(c);
  if ('refused' in found) return found.refused;
  return ok(c.state.attachments[found.event.id] ?? []);
};

const getAttachment: Handler = (c) => {
  const found = eventOf(c);
  if ('refused' in found) return found.refused;
  const attachment = (c.state.attachments[found.event.id] ?? []).find((a) => a.id === c.params.attachmentId);
  if (!attachment) return problem(404, 'attachment-not-found');
  return { status: 200, contentType: attachment.contentType, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) };
};

const deleteAttachment: Handler = (c) => {
  const found = eventOf(c);
  if ('refused' in found) return found.refused;
  const list = c.state.attachments[found.event.id] ?? [];
  const attachment = list.find((a) => a.id === c.params.attachmentId);
  if (!attachment) return problem(404, 'attachment-not-found');
  if (attachment.kind === 'SCAN_SOURCE') return problem(422, 'attachment-protected');
  c.state.attachments[found.event.id] = list.filter((a) => a !== attachment);
  found.event.attachmentCount = c.state.attachments[found.event.id].length;
  return noContent();
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
  const filters = filtersOf(c);
  if (isReply(filters)) return filters;
  const order = c.query.get('order');
  if (order !== null && order !== 'asc' && order !== 'desc') return problem(400, 'validation-failed');
  const ordered = chronological(withValidity(c.state.events[c.params.vin] ?? [])).filter((e) => matches(e, filters));
  if (order === 'desc') ordered.reverse();
  if (offset > ordered.length) return problem(400, 'invalid-cursor');
  const end = offset + limit;
  return ok({ items: ordered.slice(offset, end), nextCursor: end < ordered.length ? `c${end.toString(36)}` : null });
};

const getTimelineSummary: Handler = (c) => {
  if (!ownedVehicle(c)) return notOwned();
  const filters = filtersOf(c);
  if (isReply(filters)) return filters;
  const all = chronological(c.state.events[c.params.vin] ?? []);
  const shown = all.filter((e) => matches(e, filters));

  const counts = new Map<string, number>();
  const costs = new Map<string, number>();
  for (const e of shown) {
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    costs.set(e.currency, Math.round(((costs.get(e.currency) ?? 0) + e.costAmount) * 100) / 100);
  }

  // Distance ignores the type and component filters.
  const readings = all.filter((e) => e.odometerKm !== null);
  const before = readings.filter((e) => filters.from !== null && e.date < filters.from);
  const period = readings.filter((e) => (filters.from === null || e.date >= filters.from) && (filters.to === null || e.date <= filters.to));
  const first = before.length > 0 ? before[before.length - 1] : period[0];
  const last = period.length > 0 ? period[period.length - 1] : undefined;
  // One reading is no distance: the server answers fromKm null when the first and last readings are the same entry.
  const single = first === last;
  const fromKm = single ? null : (first?.odometerKm ?? null);
  const toKm = last?.odometerKm ?? null;
  const km = fromKm !== null && toKm !== null ? toKm - fromKm : null;

  const years = [...new Set(all.map((e) => Number(e.date.slice(0, 4))))].sort((a, b) => b - a);
  return ok({
    eventCount: shown.length,
    countsByType: EVENT_TYPES.filter((t) => counts.has(t)).map((type) => ({ type, count: counts.get(type)! })),
    costByCurrency: [...costs].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount || (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0)),
    distance: { km, fromKm, toKm },
    years,
  });
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
  if ((b.type ?? 'SERVICE') !== 'ITP' && (b.validUntil != null || b.itpResult != null)) return problem(400, 'validation-failed');
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
    validUntil: b.validUntil ?? null,
    details: { kind: 'SCAN', serviceName: b.serviceName ?? null, parts: b.parts ?? [], labor: b.labor ?? null },
    components: [],
    customFields: [],
    evidence: 'DOCUMENTED',
    source: 'SCAN',
    documentPresent: true,
    attachmentCount: 0,
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
  addAttachment,
  listAttachments,
  getAttachment,
  deleteAttachment,
  getTimeline,
  getTimelineSummary,
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
  ...accountHandlers,
};
