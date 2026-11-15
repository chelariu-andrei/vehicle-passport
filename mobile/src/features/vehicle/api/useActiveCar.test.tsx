import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useActiveCar } from './useActiveCar';
import { useVehicles } from './useVehicles';

jest.mock('@/shared/auth/session', () => ({ useSession: () => ({ userId: 'u1' }) }));
jest.mock('./useVehicles', () => ({ useVehicles: jest.fn() }));

const car = (vin: string) => ({ vin }) as never;
const garage = (data: unknown[] | undefined, isError = false) =>
  (useVehicles as jest.Mock).mockReturnValue({ data, isError, refetch: jest.fn() });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useActiveCar(), { wrapper });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('loading, then ready on the first car', async () => {
  garage([car('A'), car('B')]);
  const { result } = await setup();
  expect(result.current.status).toBe('loading');
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.car).toEqual(car('A'));
});

test('empty garage reads as empty', async () => {
  garage([]);
  const { result } = await setup();
  await waitFor(() => expect(result.current.status).toBe('empty'));
  expect(result.current.car).toBeNull();
});

test('select switches the car and remembers it', async () => {
  garage([car('A'), car('B')]);
  const { result } = await setup();
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => result.current.select('B'));
  await waitFor(() => expect(result.current.car).toEqual(car('B')));
  expect(await AsyncStorage.getItem('activeCar:u1')).toBe('B');
});

test('a removed active car falls to the next', async () => {
  await AsyncStorage.setItem('activeCar:u1', 'B');
  garage([car('A'), car('B')]);
  const { result, rerender } = await setup();
  await waitFor(() => expect(result.current.car).toEqual(car('B')));
  garage([car('A')]);
  await rerender(undefined);
  expect(result.current.car).toEqual(car('A'));
});

test('a failed garage read is an error', async () => {
  garage(undefined, true);
  const { result } = await setup();
  expect(result.current.status).toBe('error');
});
