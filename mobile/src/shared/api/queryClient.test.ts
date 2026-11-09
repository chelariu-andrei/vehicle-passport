import type { QueryClient } from '@tanstack/react-query';

import { ApiError } from './apiError';
import { createAppQueryClient } from './queryClient';

const VIN = 'WVWZZZ1JZXW000001';

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear())); // clearing cancels the cache's gc timers

function setup() {
  const onVehicleGone = jest.fn();
  const client = createAppQueryClient({ onVehicleGone });
  clients.push(client);
  const fail = (key: string, error: unknown, meta?: Record<string, unknown>) =>
    client.fetchQuery({ queryKey: [key, VIN], queryFn: () => Promise.reject(error), meta, retry: false }).catch(() => undefined);
  return { client, onVehicleGone, fail };
}

test('vehicle-not-found on a query with meta.vin calls onVehicleGone', async () => {
  const { onVehicleGone, fail } = setup();
  await fail('vehicle', new ApiError(404, 'vehicle-not-found'), { vin: VIN });
  expect(onVehicleGone).toHaveBeenCalledWith(VIN);
});

test('three failing queries for one VIN call onVehicleGone once', async () => {
  const { onVehicleGone, fail } = setup();
  const gone = new ApiError(404, 'vehicle-not-found');
  await Promise.all([fail('vehicle', gone, { vin: VIN }), fail('timeline', gone, { vin: VIN }), fail('claims', gone, { vin: VIN })]);
  expect(onVehicleGone).toHaveBeenCalledTimes(1);
});

test('it fires again for the same VIN after five seconds', async () => {
  const { onVehicleGone, fail } = setup();
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1_000_000);
  await fail('vehicle', new ApiError(404, 'vehicle-not-found'), { vin: VIN });
  now.mockReturnValue(1_006_000);
  await fail('timeline', new ApiError(404, 'vehicle-not-found'), { vin: VIN });
  expect(onVehicleGone).toHaveBeenCalledTimes(2);
  now.mockRestore();
});

test('a failing mutation with meta.vin calls onVehicleGone', async () => {
  const { client, onVehicleGone } = setup();
  await client
    .getMutationCache()
    .build(client, { mutationFn: () => Promise.reject(new ApiError(404, 'vehicle-not-found')), meta: { vin: VIN }, gcTime: 0 })
    .execute(undefined)
    .catch(() => undefined);
  expect(onVehicleGone).toHaveBeenCalledWith(VIN);
});

test('another code does not call onVehicleGone', async () => {
  const { onVehicleGone, fail } = setup();
  await fail('vehicle', new ApiError(409, 'already-owner'), { vin: VIN });
  await fail('timeline', new ApiError(404, 'vehicle-not-found'));
  expect(onVehicleGone).not.toHaveBeenCalled();
});

test('ApiError is not retried; network errors retry once', () => {
  const { client } = setup();
  const retry = client.getDefaultOptions().queries!.retry as (count: number, error: unknown) => boolean;
  expect(retry(0, new ApiError(500, 'x'))).toBe(false);
  expect(retry(0, new TypeError('Network request failed'))).toBe(true);
  expect(retry(1, new TypeError('Network request failed'))).toBe(false);
});
