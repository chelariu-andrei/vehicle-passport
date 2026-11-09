import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { aPassport, aScanJob, aVehicle, anEvent, handlers, installFakeApi, operations } from '.';
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

test('has a handler for all 24 authenticated operations', () => {
  const doc = parse(readFileSync(resolve(__dirname, '../../../contracts/openapi.yaml'), 'utf8'));
  const ids: string[] = Object.values<Record<string, any>>(doc.paths)
    .flatMap((item) => ['get', 'put', 'post', 'patch', 'delete'].map((m) => item[m]).filter(Boolean))
    .filter((op) => !(Array.isArray(op.security) && op.security.length === 0))
    .map((op) => op.operationId);
  expect(ids).toHaveLength(24);
  expect(ids).not.toContain('getPublicPassport');
  expect(ids).not.toContain('getPublicPassportPdf');
  expect(Object.keys(handlers).sort()).toEqual([...ids].sort());
  expect(operations.filter((o) => o.authenticated)).toHaveLength(24);
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
  expect(api.state.vehicles).toEqual([{ ...carBody, engine: null }]);
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
  api.state.events[VIN] = [anEvent({ details: { serviceName: 'Oil change', parts: [{ name: 'Filter', qty: 1, price: 20 }], labor: 80 } })];
  api.state.passports.push(aPassport({ vin: VIN }));
  const job = aScanJob({ status: 'EXTRACTED', fields: { total: { value: 100, confidence: 0.5 } } });
  api.state.scans[job.id] = job;
  for (const path of ['/vehicles', `/vehicles/${VIN}`, `/vehicles/${VIN}/timeline`, '/passports', `/scans/${job.id}`]) {
    expect((await send('GET', path, { headers: auth })).status).toBe(200);
  }
  expect(api.violations).toEqual([]);
});
