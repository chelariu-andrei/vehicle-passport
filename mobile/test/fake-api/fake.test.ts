import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { aClaim, anAttachment, aPassport, aScanJob, aVehicle, anEvent, handlers, installFakeApi, operations } from '.';
import type { FakeApi } from '.';

const BASE = 'http://api.test';
const VIN = 'WVWZZZ1JZXW000001';
const auth = { authorization: 'Bearer good-token' };
const json = { ...auth, 'content-type': 'application/json' };
const blobOf = (bytes: number, type: string) => new Blob([new Uint8Array(bytes)], { type });

let api: FakeApi;
beforeEach(() => {
  api = installFakeApi();
});

const send = (method: string, path: string, init: { headers?: Record<string, string>; body?: BodyInit } = {}) =>
  fetch(`${BASE}${path}`, { method, ...init });

const register = (body: object) => send('POST', '/vehicles', { headers: json, body: JSON.stringify(body) });
const carBody = { vin: VIN, make: 'Dacia', model: 'Logan', year: 2020, fuel: 'PETROL' };

test('has a handler for all 40 authenticated operations', () => {
  const doc = parse(readFileSync(resolve(__dirname, '../../../contracts/openapi.yaml'), 'utf8'));
  const ids: string[] = Object.values<Record<string, any>>(doc.paths)
    .flatMap((item) => ['get', 'put', 'post', 'patch', 'delete'].map((m) => item[m]).filter(Boolean))
    .filter((op) => !(Array.isArray(op.security) && op.security.length === 0))
    .map((op) => op.operationId);
  expect(ids).toHaveLength(40);
  expect(ids).not.toContain('getPublicPassport');
  expect(ids).not.toContain('getPublicPassportPdf');
  expect(Object.keys(handlers).sort()).toEqual([...ids].sort());
  expect(operations.filter((o) => o.authenticated)).toHaveLength(40);
});

test('an unknown JSON field answers 400 validation-failed and is recorded in violations', async () => {
  const res = await register({ ...carBody, colour: 'red' });
  expect(res.status).toBe(400);
  expect(res.headers.get('content-type')).toBe('application/problem+json');
  expect((await res.json()).code).toBe('validation-failed');
  expect(api.violations).toHaveLength(1);
  expect(api.violations[0]).toContain('registerVehicle');
  api.violations.length = 0;
});

test('no bearer answers 401 with an empty body', async () => {
  const res = await send('GET', '/vehicles');
  expect(res.status).toBe(401);
  expect(await res.text()).toBe('');
});

test('an expired token answers 401 with an empty body', async () => {
  api.expireToken('old-token');
  const res = await send('GET', '/vehicles', { headers: { authorization: 'Bearer old-token' } });
  expect(res.status).toBe(401);
  expect(await res.text()).toBe('');
  expect((await send('GET', '/vehicles', { headers: auth })).status).toBe(200);
});

test('registerVehicle answers 201 for a free VIN, and 409 already-owner for one in the garage', async () => {
  const created = await register(carBody);
  expect(created.status).toBe(201);
  expect(api.state.vehicles).toEqual([{ ...carBody, engine: null, plate: null, appearance: null }]);
  const again = await register(carBody);
  expect(again.status).toBe(409);
  expect((await again.json()).code).toBe('already-owner');
});

test('registerVehicle answers 202 for a VIN in otherOwnerVins and creates no vehicle', async () => {
  api.state.otherOwnerVins.add(VIN);
  const res = await register(carBody);
  expect(res.status).toBe(202);
  const body = await res.json();
  expect(body.claimId).toEqual(expect.any(String));
  expect(api.state.vehicles).toEqual([]);
  expect((await send('GET', '/vehicles', { headers: auth }).then((r) => r.json()))).toEqual([]);
});

test('timeline returns oldest first and pages with nextCursor', async () => {
  api.state.vehicles.push(aVehicle({ vin: VIN }));
  api.state.events[VIN] = [
    anEvent({ date: '2024-05-01', odometerKm: 50 }),
    anEvent({ date: '2024-04-01', odometerKm: 40 }),
    anEvent({ date: '2024-03-01', odometerKm: 30 }),
    anEvent({ date: '2024-02-01', odometerKm: 20 }),
    anEvent({ date: '2024-01-01', odometerKm: 10 }),
  ];
  const dates: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const query: string = `limit=2${cursor ? `&cursor=${cursor}` : ''}`;
    const page = await send('GET', `/vehicles/${VIN}/timeline?${query}`, { headers: auth }).then((r) => r.json());
    dates.push(...page.items.map((e: { date: string }) => e.date));
    cursor = page.nextCursor;
    pages += 1;
  } while (cursor);
  expect(pages).toBe(3);
  expect(dates).toEqual(['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01', '2024-05-01']);
  const bad = await send('GET', `/vehicles/${VIN}/timeline?cursor=garbage`, { headers: auth });
  expect((await bad.json()).code).toBe('invalid-cursor');
});

test('a documented event accepts only a notes change', async () => {
  api.state.vehicles.push(aVehicle({ vin: VIN }));
  const event = anEvent({ evidence: 'DOCUMENTED', source: 'SCAN', date: '2024-03-10', odometerKm: 1000, costAmount: 100 });
  api.state.events[VIN] = [event];
  const put = (patch: object) =>
    send('PUT', `/vehicles/${VIN}/events/${event.id}`, {
      headers: json,
      body: JSON.stringify({ type: 'SERVICE', date: '2024-03-10', odometerKm: 1000, costAmount: 100, currency: 'RON', ...patch }),
    });
  const changed = await put({ odometerKm: 1200 });
  expect(changed.status).toBe(422);
  expect((await changed.json()).code).toBe('documented-event-immutable');
  const noted = await put({ notes: 'receipt in glovebox' });
  expect(noted.status).toBe(200);
  expect((await noted.json()).notes).toBe('receipt in glovebox');
});

test('addEvent refuses a mileage that contradicts the history', async () => {
  api.state.vehicles.push(aVehicle({ vin: VIN }));
  api.state.events[VIN] = [anEvent({ date: '2024-03-10', odometerKm: 5000 })];
  const res = await send('POST', `/vehicles/${VIN}/events`, {
    headers: json,
    body: JSON.stringify({ type: 'REPAIR', date: '2024-06-01', odometerKm: 4000, costAmount: 10.5, currency: 'RON' }),
  });
  expect(res.status).toBe(422);
  expect((await res.json()).code).toBe('odometer-inconsistent');
});

test('listMyPassports answers newest first', async () => {
  api.state.passports.push(
    aPassport({ createdAt: '2025-01-01T00:00:00Z' }),
    aPassport({ createdAt: '2025-03-01T00:00:00Z' }),
    aPassport({ createdAt: '2025-02-01T00:00:00Z' }),
  );
  const list = await send('GET', '/passports', { headers: auth }).then((r) => r.json());
  expect(list.map((p: { createdAt: string }) => p.createdAt.slice(0, 7))).toEqual(['2025-03', '2025-02', '2025-01']);
});

test('confirmScan creates a DOCUMENTED event only from an EXTRACTED job', async () => {
  api.state.vehicles.push(aVehicle({ vin: VIN }));
  const job = aScanJob({ status: 'EXTRACTED' });
  api.state.scans[job.id] = job;
  const res = await send('POST', `/scans/${job.id}/confirm`, {
    headers: json,
    body: JSON.stringify({ date: '2024-03-10', odometerKm: 900, total: 250 }),
  });
  expect(res.status).toBe(201);
  expect(api.state.events[VIN][0]).toMatchObject({ evidence: 'DOCUMENTED', source: 'SCAN', costAmount: 250, currency: 'RON' });
  const second = await send('POST', `/scans/${job.id}/confirm`, {
    headers: json,
    body: JSON.stringify({ date: '2024-03-10', odometerKm: 900, total: 250 }),
  });
  expect((await second.json()).code).toBe('scan-state-conflict');
});

describe('uploads', () => {
  beforeEach(() => {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
  });

  const upload = (path: string, field: string, files: Blob[]) => {
    const form = new FormData();
    files.forEach((f, i) => form.append(field, f, `photo-${i}`));
    return send('POST', path, { headers: auth, body: form });
  };

  test('a multipart part over 10 485 760 bytes answers 413 file-too-large', async () => {
    const res = await upload(`/vehicles/${VIN}/scans`, 'file', [blobOf(10_485_761, 'image/jpeg')]);
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe('file-too-large');
  });

  test('a part of exactly 10 485 760 bytes is accepted and recorded', async () => {
    const res = await upload(`/vehicles/${VIN}/scans`, 'file', [blobOf(10_485_760, 'image/jpeg')]);
    expect(res.status).toBe(202);
    expect(api.callsTo('submitScan')[0].parts).toEqual([{ field: 'file', name: 'photo-0', type: 'image/jpeg', size: 10_485_760 }]);
  });

  test('a multipart part of type image/heic answers 415 unsupported-file', async () => {
    const res = await upload(`/vehicles/${VIN}/scans`, 'file', [blobOf(100, 'image/heic')]);
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe('unsupported-file');
  });

  test('one bad file rejects the whole batch', async () => {
    const res = await upload(`/vehicles/${VIN}/scan-batches`, 'files', [blobOf(10, 'image/jpeg'), blobOf(10, 'image/heic')]);
    expect(res.status).toBe(415);
    expect(Object.keys(api.state.scans)).toHaveLength(0);
  });

  test('20 files answer 202 with one job each', async () => {
    const res = await upload(`/vehicles/${VIN}/scan-batches`, 'files', Array.from({ length: 20 }, () => blobOf(10, 'image/jpeg')));
    expect(res.status).toBe(202);
    expect((await res.json()).jobs).toHaveLength(20);
  });

  test('21 files answer 422 batch-too-large', async () => {
    const res = await upload(`/vehicles/${VIN}/scan-batches`, 'files', Array.from({ length: 21 }, () => blobOf(10, 'image/jpeg')));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('batch-too-large');
  });
});

test('failNext answers once with that status and code as problem+json', async () => {
  api.failNext('listMyVehicles', 503, 'upstream-down');
  const first = await send('GET', '/vehicles', { headers: auth });
  expect(first.status).toBe(503);
  expect(first.headers.get('content-type')).toBe('application/problem+json');
  expect(await first.json()).toMatchObject({ status: 503, code: 'upstream-down' });
  expect((await send('GET', '/vehicles', { headers: auth })).status).toBe(200);
});

test('failNext with a null code answers with an empty body', async () => {
  api.failNext('listMyVehicles', 500, null);
  const res = await send('GET', '/vehicles', { headers: auth });
  expect(res.status).toBe(500);
  expect(await res.text()).toBe('');
});

test('failNext can inject event-from-prior-owner and document-restricted', async () => {
  api.failNext('updateEvent', 403, 'event-from-prior-owner');
  api.failNext('getEventDocument', 403, 'document-restricted');
  const id = '11111111-1111-4111-8111-111111111111';
  const put = await send('PUT', `/vehicles/${VIN}/events/${id}`, {
    headers: json,
    body: JSON.stringify({ type: 'SERVICE', date: '2024-03-10', odometerKm: 1, costAmount: 1, currency: 'RON' }),
  });
  expect((await put.json()).code).toBe('event-from-prior-owner');
  const doc = await send('GET', `/vehicles/${VIN}/events/${id}/document`, { headers: auth });
  expect((await doc.json()).code).toBe('document-restricted');
});

test('callsTo records path, headers and parsed body', async () => {
  await register(carBody);
  const [call] = api.callsTo('registerVehicle');
  expect(call.path).toBe('/vehicles');
  expect(call.headers.authorization).toBe('Bearer good-token');
  expect(call.body).toEqual(carBody);
});

test('builders produce records the fake serves without breaking the contract', async () => {
  api.state.vehicles.push(aVehicle({ vin: VIN }));
  api.state.events[VIN] = [anEvent({ details: { kind: 'SCAN', serviceName: 'Oil change', parts: [{ name: 'Filter', qty: 1, price: 20 }], labor: 80 } })];
  api.state.passports.push(aPassport({ vin: VIN }));
  const job = aScanJob({ status: 'EXTRACTED', fields: { total: { value: 100, confidence: 0.5 } } });
  api.state.scans[job.id] = job;
  for (const path of ['/vehicles', `/vehicles/${VIN}`, `/vehicles/${VIN}/timeline`, '/passports', `/scans/${job.id}`]) {
    expect((await send('GET', path, { headers: auth })).status).toBe(200);
  }
  expect(api.violations).toEqual([]);
});

describe('ownership ending', () => {
  const post = (path: string, body?: object) =>
    send('POST', path, { headers: json, body: body ? JSON.stringify(body) : undefined });

  async function carWithJobs() {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
    const form = new FormData();
    form.append('file', blobOf(10, 'image/jpeg'), 'a.jpg');
    const uploaded = await send('POST', `/vehicles/${VIN}/scans`, { headers: auth, body: form }).then((r) => r.json());
    api.state.scans[uploaded.id].status = 'EXTRACTED';
    const confirmed = aScanJob({ status: 'CONFIRMED' });
    api.state.scans[confirmed.id] = confirmed;
    return uploaded.id as string;
  }

  test('releaseVehicle cancels unconfirmed scan jobs, and confirm then answers 409', async () => {
    const jobId = await carWithJobs();
    expect((await post(`/vehicles/${VIN}/release`)).status).toBe(204);
    expect(api.state.scans[jobId].status).toBe('CANCELLED');
    const confirm = await post(`/scans/${jobId}/confirm`, { date: '2024-03-10', odometerKm: 1, total: 1 });
    expect(confirm.status).toBe(409);
    expect((await confirm.json()).code).toBe('scan-state-conflict');
    expect(api.state.events[VIN] ?? []).toEqual([]);
  });

  test('approveClaim cancels unconfirmed scan jobs and leaves confirmed ones', async () => {
    const jobId = await carWithJobs();
    const claim = aClaim();
    api.state.claims[VIN] = [claim];
    expect((await post(`/vehicles/${VIN}/claims/${claim.claimId}/approve`)).status).toBe(204);
    expect(api.state.scans[jobId].status).toBe('CANCELLED');
    expect(Object.values(api.state.scans).filter((j) => j.status === 'CONFIRMED')).toHaveLength(1);
  });

  test('a decided claim answers 409 claim-not-pending, an unknown one 404 claim-not-found', async () => {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
    const [a, b, c] = [aClaim(), aClaim(), aClaim()];
    api.state.claims[VIN] = [a, b, c];
    expect((await post(`/vehicles/${VIN}/claims/${a.claimId}/reject`)).status).toBe(204);
    const again = await post(`/vehicles/${VIN}/claims/${a.claimId}/reject`);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe('claim-not-pending');
    const unknown = await post(`/vehicles/${VIN}/claims/11111111-1111-4111-8111-111111111111/reject`);
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).code).toBe('claim-not-found');
    const list = await send('GET', `/vehicles/${VIN}/claims`, { headers: auth }).then((r) => r.json());
    expect(list).toEqual([{ claimId: b.claimId, filedAt: b.filedAt }, { claimId: c.claimId, filedAt: c.filedAt }]);
  });

  test('approving rejects the other pending claims, so withdrawing one answers 409', async () => {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
    const [a, b] = [aClaim(), aClaim()];
    api.state.claims[VIN] = [a, b];
    expect((await post(`/vehicles/${VIN}/claims/${a.claimId}/approve`)).status).toBe(204);
    const withdrawOther = await post(`/ownership-claims/${b.claimId}/withdraw`);
    expect(withdrawOther.status).toBe(409);
    expect((await withdrawOther.json()).code).toBe('claim-not-pending');
  });

  test('withdrawing twice answers 409 the second time', async () => {
    api.state.otherOwnerVins.add(VIN);
    const claimId = (await register(carBody).then((r) => r.json())).claimId;
    expect((await post(`/ownership-claims/${claimId}/withdraw`)).status).toBe(204);
    const again = await post(`/ownership-claims/${claimId}/withdraw`);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe('claim-not-pending');
  });
});

describe('vehicle plate and appearance', () => {
  const patch = (body: object) => send('PATCH', `/vehicles/${VIN}`, { headers: json, body: JSON.stringify(body) });

  test('stores a look and a plate on update', async () => {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
    const res = await patch({ plate: 'B 123 ABC', appearance: { bodyType: 'SUV', color: 'BLUE', finish: 'MATTE' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plate: 'B 123 ABC', appearance: { bodyType: 'SUV', color: 'BLUE', finish: 'MATTE' } });
  });

  test('clears the plate with null and replaces the whole appearance', async () => {
    api.state.vehicles.push(aVehicle({ vin: VIN, plate: 'B 123 ABC', appearance: { bodyType: 'SUV', color: 'BLUE' } }));
    const res = await patch({ plate: null, appearance: { color: 'RED' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plate).toBeNull();
    expect(body.appearance).toEqual({ color: 'RED' });
  });

  test.each([
    { plate: 'b 123' },
    { plate: 'ABCDEFGHIJK' },
    { appearance: { bodyType: 'BUGGY' } },
    { appearance: { colorHex: 'red' } },
    { appearance: { extra: 1 } },
  ])('rejects %j against the contract', async (body) => {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('validation-failed');
    expect(api.violations).toHaveLength(1);
    api.violations.length = 0;
  });

  test('registers a car with no plate and no look', async () => {
    const res = await register(carBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.plate).toBeNull();
    expect(body.appearance).toBeNull();
  });
});

describe('attachments', () => {
  const upload = (eventId: string, bytes: number[], type = 'image/jpeg') => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(bytes)], { type }), 'scan.jpg');
    return send('POST', `/vehicles/${VIN}/events/${eventId}/attachments`, { headers: auth, body: form });
  };
  const setup = () => {
    api.state.vehicles.push(aVehicle({ vin: VIN }));
    const event = anEvent();
    api.state.events[VIN] = [event];
    return event;
  };

  test('addAttachment answers 201 with an UPLOAD attachment and counts it on the event', async () => {
    const event = setup();
    const res = await upload(event.id, [1, 2, 3]);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ contentType: 'image/jpeg', sizeBytes: 3, kind: 'UPLOAD' });
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(event.attachmentCount).toBe(1);
    const list = await send('GET', `/vehicles/${VIN}/events/${event.id}/attachments`, { headers: auth });
    expect(await list.json()).toEqual([body]);
    const file = await send('GET', `/vehicles/${VIN}/events/${event.id}/attachments/${body.id}`, { headers: auth });
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/jpeg');
  });

  test('the same bytes twice answer 409 duplicate-document', async () => {
    const event = setup();
    expect((await upload(event.id, [1, 2, 3])).status).toBe(201);
    const again = await upload(event.id, [1, 2, 3]);
    expect(again.status).toBe(409);
    expect((await again.json()).code).toBe('duplicate-document');
  });

  test('the 11th attachment answers 422 attachment-limit', async () => {
    const event = setup();
    for (let i = 0; i < 10; i++) expect((await upload(event.id, [i])).status).toBe(201);
    const res = await upload(event.id, [99]);
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe('attachment-limit');
  });

  test('an unsupported type answers 415', async () => {
    const event = setup();
    expect((await upload(event.id, [1], 'text/plain')).status).toBe(415);
  });

  test('delete removes an UPLOAD, refuses a SCAN_SOURCE with 422, and 404s an unknown id', async () => {
    const event = setup();
    const added = await (await upload(event.id, [1])).json();
    const base = `/vehicles/${VIN}/events/${event.id}/attachments`;
    expect((await send('DELETE', `${base}/${added.id}`, { headers: auth })).status).toBe(204);
    expect(event.attachmentCount).toBe(0);
    const missing = await send('DELETE', `${base}/${added.id}`, { headers: auth });
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe('attachment-not-found');
    const source = anAttachment({ kind: 'SCAN_SOURCE', sha256: null });
    api.state.attachments[event.id] = [source];
    const refused = await send('DELETE', `${base}/${source.id}`, { headers: auth });
    expect(refused.status).toBe(422);
    expect((await refused.json()).code).toBe('attachment-protected');
  });
});

describe('account operations', () => {
  const get = (path: string) => send('GET', path, { headers: auth });
  const write = (method: string, path: string, body: object) =>
    send(method, path, { headers: json, body: JSON.stringify(body) });

  test('profile, settings, consents, deletion, export and support answer in line with the contract', async () => {
    const me = await (await get('/me')).json();
    expect(me.consent.required).toBe(true);

    const patched = await write('PATCH', '/me', { displayName: '  Ana Pop ', phone: '+40712345678' });
    expect((await patched.json()).displayName).toBe('Ana Pop');
    expect((await write('PATCH', '/me', { phone: '0712345678' })).status).toBe(400);
    api.violations.length = 0;
    expect((await (await write('PATCH', '/me', { phone: null })).json()).phone).toBeNull();

    const settings = await (await get('/me/settings')).json();
    const changed = { ...settings, language: 'ro' };
    expect((await (await write('PUT', '/me/settings', changed)).json()).language).toBe('ro');

    const stale = await write('POST', '/me/consents', {
      accept: [{ type: 'terms', version: '0.9' }],
      source: 'sign-up-form',
    });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('consent-version-outdated');
    const accepted = await write('POST', '/me/consents', {
      accept: [
        { type: 'terms', version: '1.0' },
        { type: 'privacy', version: '1.0' },
      ],
      marketing: true,
      source: 'sign-up-form',
    });
    expect((await accepted.json()).required).toBe(false);
    expect((await (await get('/me/consents/history')).json()).items).toHaveLength(3);

    expect((await send('DELETE', '/me/deletion', { headers: auth })).status).toBe(404);
    expect((await send('POST', '/me/deletion', { headers: auth })).status).toBe(201);
    expect((await send('POST', '/me/deletion', { headers: auth })).status).toBe(409);
    expect((await (await get('/me')).json()).deletion.scheduledFor).toEqual(expect.any(String));
    expect((await send('DELETE', '/me/deletion', { headers: auth })).status).toBe(204);

    const report = await write('POST', '/support/reports', {
      kind: 'problem',
      message: 'The scan screen freezes.',
      includeDiagnostics: false,
    });
    expect(report.status).toBe(201);
    const exported = await (await get('/me/export')).json();
    expect(exported.supportReports).toHaveLength(1);
    expect(exported.consents).toHaveLength(3);
    expect(api.violations).toEqual([]);
  });
});

describe('timeline filters and summary', () => {
  beforeEach(() => {
    api.state.vehicles.push(aVehicle());
    api.state.events[VIN] = [
      anEvent({ date: '2023-01-10', odometerKm: 1000, costAmount: 100, components: ['BRAKES'] }),
      anEvent({ type: 'ITP', date: '2024-02-10', odometerKm: 2000, costAmount: 50 }),
      anEvent({ type: 'REPAIR', date: '2024-06-10', odometerKm: null, costAmount: 300, components: ['ENGINE'] }),
    ];
  });

  test('filters narrow the page and the summary; years and distance ignore them', async () => {
    const page = await send('GET', `/vehicles/${VIN}/timeline?type=ITP&type=REPAIR&from=2024-01-01&order=desc`, { headers: auth }).then((r) => r.json());
    expect(page.items.map((e: { type: string }) => e.type)).toEqual(['REPAIR', 'ITP']);
    const summary = await send('GET', `/vehicles/${VIN}/timeline/summary?component=ENGINE&from=2024-01-01`, { headers: auth }).then((r) => r.json());
    expect(summary).toEqual({
      eventCount: 1,
      countsByType: [{ type: 'REPAIR', count: 1 }],
      costByCurrency: [{ currency: 'RON', amount: 300 }],
      distance: { km: 1000, fromKm: 1000, toKm: 2000 },
      years: [2024, 2023],
    });
    expect((await send('GET', `/vehicles/${VIN}/timeline/summary?from=2025-01-01&to=2024-01-01`, { headers: auth })).status).toBe(400);
  });

  test('only the newest entry of a kind has a live validity status', async () => {
    api.state.events[VIN] = [
      anEvent({ type: 'ITP', date: '2022-02-10', validUntil: '2099-01-01' }),
      anEvent({ type: 'ITP', date: '2024-02-10', validUntil: '2099-01-01' }),
    ];
    const page = await send('GET', `/vehicles/${VIN}/timeline`, { headers: auth }).then((r) => r.json());
    expect(page.items.map((e: { validityStatus: string }) => e.validityStatus)).toEqual(['SUPERSEDED', 'VALID']);
  });
});
