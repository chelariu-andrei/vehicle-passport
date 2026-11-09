import { aVehicle, installFakeApi } from '../../../test/fake-api';
import type { FakeApi } from '../../../test/fake-api';
import { fakeAuth } from '../../../test/fakes/auth';
import { ApiError, isApiError, unwrap } from './apiError';
import { api } from './client';

const VIN = 'WVWZZZ1JZXW000001';
let fake: FakeApi;
beforeEach(() => {
  fake = installFakeApi();
});

test('an expired token is refreshed once and the request succeeds', async () => {
  fake.state.vehicles.push(aVehicle({ vin: VIN }));
  fake.expireToken(fakeAuth.token!);
  const list = unwrap(await api.GET('/vehicles'));
  expect(list).toBeDefined();
  expect(fakeAuth.refreshCalls).toBe(1);
  expect(fake.callsTo('listMyVehicles')).toHaveLength(2);
});

test('several screens expiring together cause exactly one refresh', async () => {
  fake.state.vehicles.push(aVehicle({ vin: VIN }));
  fake.expireToken(fakeAuth.token!);
  const results = await Promise.all([
    api.GET('/vehicles'),
    api.GET('/vehicles'),
    api.GET('/vehicles/{vin}', { params: { path: { vin: VIN } } }),
  ]);
  expect(results.every((r) => r.response.status === 200)).toBe(true);
  expect(fakeAuth.refreshCalls).toBe(1);
});

test('a refused refresh signs out and surfaces the 401', async () => {
  fake.expireToken(fakeAuth.token!);
  fakeAuth.failRefresh();
  const result = await api.GET('/vehicles');
  expect(result.response.status).toBe(401);
  expect(fakeAuth.signOutCalls).toBe(1);
});

test('problem+json becomes an ApiError with the code', async () => {
  let thrown: unknown;
  try {
    unwrap(await api.GET('/vehicles/{vin}', { params: { path: { vin: VIN } } }));
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(ApiError);
  expect(isApiError(thrown, 'vehicle-not-found')).toBe(true);
});
