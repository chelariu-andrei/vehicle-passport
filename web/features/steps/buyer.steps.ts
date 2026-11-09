import assert from 'node:assert/strict';
import { Given, Then, When, Before } from '@cucumber/cucumber';
import { createApp } from '../../src/app.ts';

type Json = Record<string, unknown>;
type Call = { url: string; headers: Headers };

const TOKEN = 'tok_abc-123';
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const MESSAGE = 'This passport is no longer available.';
const PROBLEM = 'We cannot show this passport right now. Please try again in a moment.';

function baseEvent(over: Json = {}): Json {
  return {
    type: 'SERVICE',
    date: '2025-03-14',
    odometerKm: 84200,
    costAmount: '120.00',
    currency: 'RON',
    notes: null,
    serviceName: 'Auto Service Nord',
    parts: [{ name: 'Oil filter', qty: 1, price: '30.00' }],
    labor: '90.00',
    evidence: 'ESTIMATED',
    documentPresent: false,
    ...over,
  };
}

class State {
  event: Json = baseEvent();
  snapshotOverride: Json | undefined;
  apiMode: 'ok' | '404' | 'down' = 'ok';
  calls: Call[] = [];
  response!: Response;
  body = '';
}
const s = new State();

Before(() => {
  s.event = baseEvent();
  s.snapshotOverride = undefined;
  s.apiMode = 'ok';
  s.calls = [];
});

function app() {
  const stub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    s.calls.push({ url, headers: new Headers(init?.headers) });
    if (s.apiMode === 'down') throw new TypeError('connect ECONNREFUSED');
    if (s.apiMode === '404') {
      return new Response(JSON.stringify({ code: 'passport-not-found' }), {
        status: 404,
        headers: { 'content-type': 'application/problem+json' },
      });
    }
    if (url.endsWith('/pdf')) {
      return new Response(PDF_BYTES, { status: 200, headers: { 'content-type': 'application/pdf' } });
    }
    const snapshot = s.snapshotOverride ?? {
      vehicle: { vin: 'WBA8E1C50GK123456', make: 'BMW', model: '330i', engine: '2.0 L', year: 2016, fuel: 'PETROL' },
      events: [s.event],
    };
    return Response.json({ snapshot, hash: 'ab12cd34ef56', algorithm: 'SHA-256' });
  }) as typeof fetch;
  return createApp({ apiBaseUrl: 'http://api.test', fetch: stub });
}

async function load(path: string) {
  s.response = await app().request(path);
  s.body = await s.response.text();
}

When('the page loads a valid token', () => load(`/public/passports/${TOKEN}`));
When('the page loads any token', () => load(`/public/passports/${TOKEN}`));

When('the API answers 404', async () => {
  s.apiMode = '404';
  await load(`/public/passports/${TOKEN}`);
});

When('the API cannot be reached', async () => {
  s.apiMode = 'down';
  await load(`/public/passports/${TOKEN}`);
});

When('I open the PDF of a valid token', async () => {
  s.response = await app().request(`/public/passports/${TOKEN}/pdf`);
  s.body = '';
});

Given('an event\'s notes contain {string}', (notes: string) => {
  s.event = baseEvent({ notes });
});
Given('an event costing {string}', (cost: string) => {
  s.event = baseEvent({ costAmount: cost });
});
Given('an event without {string}', (key: string) => {
  const event = baseEvent();
  delete event[key];
  s.event = event;
});
Given('an event with evidence {string}', (evidence: string) => {
  s.event = baseEvent({ evidence });
});
Given('the API returns a snapshot with no vehicle', () => {
  s.snapshotOverride = { events: [baseEvent()] };
});

Given('the page loads that snapshot', async () => load(`/public/passports/${TOKEN}`));

// Steps that follow a Given alone need the page loaded first.
async function ensureLoaded() {
  if (!s.response || s.calls.length === 0) await load(`/public/passports/${TOKEN}`);
}

Then('I see the vehicle, its events with evidence, and the hash', () => {
  assert.equal(s.response.status, 200);
  for (const text of ['BMW', '330i', 'WBA8E1C50GK123456', 'Estimated', 'Auto Service Nord', 'ab12cd34ef56', 'SHA-256']) {
    assert.ok(s.body.includes(text), `missing ${text}`);
  }
  assert.match(s.body, /integrity/i);
  assert.ok(!/install|app store|google play/i.test(s.body));
});

Then('no owner data appears', () => {
  assert.ok(!/owner|claimant|email/i.test(s.body.replace(/Owner data is never shown/gi, '')));
});

Then('I see one message, with no reason given', () => {
  assert.equal(s.response.status, 404);
  assert.ok(s.body.includes(MESSAGE));
  assert.ok(!/revoked|expired|unknown/i.test(s.body));
});

Then('it is displayed as plain text', async () => {
  await ensureLoaded();
  assert.ok(s.body.includes('&lt;script&gt;'));
  assert.ok(!s.body.includes('<script>'));
});

Then('the response has {string}', async (header: string) => {
  assertHeader(header);
});
Then('{string}', (header: string) => {
  assertHeader(header);
});

function assertHeader(header: string) {
  const [name, ...rest] = header.split(': ');
  assert.equal(s.response.headers.get(name), rest.join(': '));
}

Then('I receive application\\/pdf from the API without an Authorization header', async () => {
  assert.equal(s.response.status, 200);
  assert.equal(s.response.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(new Uint8Array(await s.response.arrayBuffer()), PDF_BYTES);
  assert.equal(s.calls.length, 1);
  assert.ok(s.calls[0].url.endsWith(`/public/passports/${TOKEN}/pdf`));
  assert.equal(s.calls[0].headers.get('authorization'), null);
  assertHeader('Referrer-Policy: no-referrer');
  assertHeader('Cache-Control: no-store');
  assertHeader('X-Robots-Tag: noindex');
});

Then('the page shows {string}', async (text: string) => {
  await ensureLoaded();
  assert.ok(s.body.includes(text));
});

Then('the page still renders', async () => {
  await ensureLoaded();
  assert.equal(s.response.status, 200);
  assert.ok(s.body.includes('Auto Service Nord'));
});

Then('I see {string}', async (text: string) => {
  await ensureLoaded();
  assert.ok(s.body.includes(text));
});

Then('the word {string} does not appear', (word: string) => {
  assert.ok(!s.body.toLowerCase().includes(word.toLowerCase()));
});

Then('I see a temporary-problem message and status 502', async () => {
  await ensureLoaded();
  assert.equal(s.response.status, 502);
  assert.ok(s.body.includes(PROBLEM));
  assertHeader('Cache-Control: no-store');
});
