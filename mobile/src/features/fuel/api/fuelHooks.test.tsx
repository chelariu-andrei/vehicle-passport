import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { isApiError, qk } from '@/shared/api';

import { aFuelEntry, aFuelStats, aVehicle, installFakeApi } from '../../../../test/fake-api';
import type { FuelEntryRequest } from '../model/fuelForm';
import { useAddFuelEntry } from './useAddFuelEntry';
import { useDeleteFuelEntry } from './useDeleteFuelEntry';
import { useFuelEntries } from './useFuelEntries';
import { useFuelStats } from './useFuelStats';
import { useUpdateFuelEntry } from './useUpdateFuelEntry';

const VIN = 'WVWZZZ1JZXW000001';
const request = (o: Partial<FuelEntryRequest> = {}): FuelEntryRequest => ({
  date: '2026-10-01',
  odometerKm: 10_000,
  fuelType: 'DIESEL',
  quantity: 40,
  total: 300,
  currency: 'RON',
  fullTank: true,
  missedPrevious: false,
  ...o,
});

let api: ReturnType<typeof installFakeApi>;
let client: QueryClient;
beforeEach(() => {
  api = installFakeApi();
  api.state.vehicles.push(aVehicle({ vin: VIN, fuel: 'DIESEL' }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

// Query results only re-render for the properties a hook read, so the tests spread the whole result.
test('stats are requested with the chosen period', async () => {
  api.state.fuelStats[VIN] = aFuelStats({ entryCount: 3 });
  const { result } = await renderHook(() => ({ ...useFuelStats(VIN, '12m') }), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.entryCount).toBe(3);
  expect(api.callsTo('getFuelStats')[0].path).toContain('period=12m');
});

test('adding an entry refreshes the list and the stats', async () => {
  const entries = await renderHook(() => ({ ...useFuelEntries(VIN) }), { wrapper });
  const stats = await renderHook(() => ({ ...useFuelStats(VIN, '6m') }), { wrapper });
  await waitFor(() => expect(entries.result.current.isSuccess && stats.result.current.isSuccess).toBe(true));
  expect(entries.result.current.data).toHaveLength(0);

  const add = await renderHook(() => useAddFuelEntry(VIN), { wrapper });
  await act(async () => {
    await add.result.current.mutateAsync(request());
  });
  await waitFor(() => expect(entries.result.current.data).toHaveLength(1));
  await waitFor(() => expect(stats.result.current.data?.entryCount).toBe(1));
  expect(client.getQueryState(qk.fuelStats(VIN, '6m'))?.isInvalidated).toBe(false);
});

test('an odometer conflict surfaces as an ApiError with its code', async () => {
  api.state.fuel[VIN] = [aFuelEntry({ date: '2026-10-01', odometerKm: 10_000 })];
  const add = await renderHook(() => useAddFuelEntry(VIN), { wrapper });
  let error: unknown;
  await act(async () => {
    error = await add.result.current.mutateAsync(request({ date: '2026-10-20', odometerKm: 9_000 })).catch((e) => e);
  });
  expect(isApiError(error, 'odometer-inconsistent')).toBe(true);
});

test('update replaces the entry and delete removes it', async () => {
  const existing = aFuelEntry({ date: '2026-10-01', odometerKm: 10_000 });
  api.state.fuel[VIN] = [existing];
  const update = await renderHook(() => useUpdateFuelEntry(VIN, existing.id), { wrapper });
  await act(async () => {
    await update.result.current.mutateAsync(request({ total: 320 }));
  });
  expect(api.state.fuel[VIN][0].total).toBe(320);

  const del = await renderHook(() => useDeleteFuelEntry(VIN, existing.id), { wrapper });
  await act(async () => {
    await del.result.current.mutateAsync();
  });
  expect(api.state.fuel[VIN]).toHaveLength(0);
});

test('list pages follow the cursor', async () => {
  api.state.fuel[VIN] = Array.from({ length: 35 }, (_, i) =>
    aFuelEntry({ date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, odometerKm: 1000 + i * 10 }),
  );
  const { result } = await renderHook(() => ({ ...useFuelEntries(VIN) }), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(30);
  expect(result.current.hasNextPage).toBe(true);
  await act(async () => {
    await result.current.fetchNextPage();
  });
  await waitFor(() => expect(result.current.data).toHaveLength(35));
  expect(result.current.hasNextPage).toBe(false);
});
