import type { AuthPort } from '../auth/authPort';
import { createAuthedFetch } from './authedFetch';

function setup(statuses: { status: number; body?: string }[]) {
  let token: string | null = 'old';
  let generation = 0;
  let refuse = false;
  const auth = {
    refreshCalls: 0,
    signOutCalls: 0,
    getAccessToken: async () => token,
    refresh: async () => {
      auth.refreshCalls += 1;
      await Promise.resolve();
      if (refuse) return null;
      token = `new-${++generation}`;
      return token;
    },
    signOutLocal: async () => {
      auth.signOutCalls += 1;
    },
  } satisfies AuthPort & { refreshCalls: number; signOutCalls: number };
  const seen: { token: string | null; body: string }[] = [];
  const mock = jest.fn(async (request: Request) => {
    seen.push({ token: request.headers.get('authorization'), body: await request.clone().text() });
    const next = statuses.shift() ?? { status: 200 };
    return new Response(next.body ?? (next.status === 200 ? '{}' : ''), { status: next.status });
  });
  return { auth, baseFetch: mock as unknown as typeof fetch, mock, seen, refuse: () => (refuse = true) };
}

const get = () => new Request('http://api.test/vehicles');

test('adds the bearer token', async () => {
  const s = setup([{ status: 200 }]);
  await createAuthedFetch(s.auth, s.baseFetch)(get());
  expect(s.seen[0].token).toBe('Bearer old');
});

test('an empty 401 refreshes once and retries once with the new token', async () => {
  const s = setup([{ status: 401 }, { status: 200 }]);
  const response = await createAuthedFetch(s.auth, s.baseFetch)(get());
  expect(response.status).toBe(200);
  expect(s.auth.refreshCalls).toBe(1);
  expect(s.seen.map((x) => x.token)).toEqual(['Bearer old', 'Bearer new-1']);
});

test('the retried request keeps its JSON body', async () => {
  const s = setup([{ status: 401 }, { status: 200 }]);
  const request = new Request('http://api.test/vehicles', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vin: 'X' }),
  });
  await createAuthedFetch(s.auth, s.baseFetch)(request);
  expect(s.seen.map((x) => x.body)).toEqual(['{"vin":"X"}', '{"vin":"X"}']);
});

test('a second 401 signs out and returns the 401', async () => {
  const s = setup([{ status: 401 }, { status: 401 }]);
  const response = await createAuthedFetch(s.auth, s.baseFetch)(get());
  expect(response.status).toBe(401);
  expect(s.auth.signOutCalls).toBeGreaterThan(0);
  expect(s.mock).toHaveBeenCalledTimes(2);
});

test('a refused refresh signs out without retrying', async () => {
  const s = setup([{ status: 401 }, { status: 200 }]);
  s.refuse();
  const response = await createAuthedFetch(s.auth, s.baseFetch)(get());
  expect(response.status).toBe(401);
  expect(s.auth.signOutCalls).toBe(1);
  expect(s.mock).toHaveBeenCalledTimes(1);
});

test('a 401 with a body is returned untouched and does not refresh', async () => {
  const s = setup([{ status: 401, body: '{"code":"x"}' }]);
  const response = await createAuthedFetch(s.auth, s.baseFetch)(get());
  expect(response.status).toBe(401);
  expect(await response.text()).toBe('{"code":"x"}');
  expect(s.auth.refreshCalls).toBe(0);
  expect(s.auth.signOutCalls).toBe(0);
});

test('three concurrent 401s cause one refresh and three retries', async () => {
  const s = setup([{ status: 401 }, { status: 401 }, { status: 401 }, { status: 200 }, { status: 200 }, { status: 200 }]);
  const authed = createAuthedFetch(s.auth, s.baseFetch);
  const responses = await Promise.all([authed(get()), authed(get()), authed(get())]);
  expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
  expect(s.auth.refreshCalls).toBe(1);
  expect(s.mock).toHaveBeenCalledTimes(6);
  expect(s.seen.slice(3).every((x) => x.token === 'Bearer new-1')).toBe(true);
});

test('a public path gets no Authorization header', async () => {
  const s = setup([{ status: 200 }]);
  await createAuthedFetch(s.auth, s.baseFetch)(new Request('http://api.test/public/passports/abc'));
  expect(s.seen[0].token).toBeNull();
});

test('an empty 401 on a public path causes no refresh and no sign-out', async () => {
  const s = setup([{ status: 401 }, { status: 200 }]);
  const response = await createAuthedFetch(s.auth, s.baseFetch)(new Request('http://api.test/public/passports/abc'));
  expect(response.status).toBe(401);
  expect(s.auth.refreshCalls).toBe(0);
  expect(s.auth.signOutCalls).toBe(0);
  expect(s.mock).toHaveBeenCalledTimes(1);
});
