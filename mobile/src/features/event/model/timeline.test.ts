import { ApiError } from '@/shared/api';

import { aVehicle, anEvent, installFakeApi, SAMPLE_VIN } from '../../../../test/fake-api';
import { fetchFullTimeline, latestOdometer } from './timeline';

function seed(count: number) {
  const fake = installFakeApi();
  fake.state.vehicles.push(aVehicle());
  // Dates ascend with the index, so the server's oldest-first order is the array order.
  fake.state.events[SAMPLE_VIN] = Array.from({ length: count }, (_, i) =>
    anEvent({ date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10), odometerKm: 1000 + i }),
  );
  return fake;
}

/** Makes the first request carrying a cursor answer 400 invalid-cursor, and every later one too when `always`. */
function breakCursor(always: boolean) {
  const real = globalThis.fetch;
  let broken = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes('cursor=') && (always || broken === 0)) {
      broken++;
      return new Response(JSON.stringify({ type: 'x', title: 'x', status: 400, detail: 'x', code: 'invalid-cursor' }), {
        status: 400,
        headers: { 'content-type': 'application/problem+json' },
      });
    }
    return real(input, init);
  }) as typeof fetch;
}

test('follows nextCursor with limit=100 until null and reverses', async () => {
  const fake = seed(250);
  const events = await fetchFullTimeline(SAMPLE_VIN);
  expect(events).toHaveLength(250);
  expect(events[0].odometerKm).toBe(1249);
  expect(events[249].odometerKm).toBe(1000);
  const calls = fake.callsTo('getTimeline');
  expect(calls).toHaveLength(3);
  expect(calls.every((call) => call.path.includes('limit=100'))).toBe(true);
  expect(calls[0].path).not.toContain('cursor');
  expect(calls[1].path).toContain('cursor=');
});

test('invalid-cursor restarts once, then throws', async () => {
  const fake = seed(150);
  breakCursor(false);
  expect(await fetchFullTimeline(SAMPLE_VIN)).toHaveLength(150);
  // page 1, broken page 2, restart: page 1, page 2.
  expect(fake.callsTo('getTimeline')).toHaveLength(3);
});

test('a cursor that stays invalid fails after one restart', async () => {
  const fake = seed(150);
  breakCursor(true);
  const failure = await fetchFullTimeline(SAMPLE_VIN).catch((e: unknown) => e);
  expect(failure).toBeInstanceOf(ApiError);
  expect((failure as ApiError).code).toBe('invalid-cursor');
  // page 1, broken page 2, page 1 again, broken page 2 again: no third attempt.
  expect(fake.callsTo('getTimeline')).toHaveLength(2);
});

test('latestOdometer is null without entries', () => {
  expect(latestOdometer([])).toBeNull();
});

test('latestOdometer reads the first entry, which is the newest', () => {
  expect(latestOdometer([anEvent({ odometerKm: 200, evidence: 'DOCUMENTED' }), anEvent({ odometerKm: 100 })])).toEqual({
    km: 200,
    evidence: 'DOCUMENTED',
  });
});
