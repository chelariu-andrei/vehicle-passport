import { useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

import { activeCarStore, pickActive } from '../model/activeCar';
import { useVehicles } from './useVehicles';
import type { VehicleResponse } from './useVehicles';

type ActiveCar =
  | { status: 'loading' | 'error' | 'empty'; car: null; cars: VehicleResponse[]; select(vin: string): void; refetch(): void }
  | { status: 'ready'; car: VehicleResponse; cars: VehicleResponse[]; select(vin: string): void; refetch(): void };

/** The car the app is about. Reads the garage plus the remembered choice and falls to the first car if the choice is gone. */
export function useActiveCar(): ActiveCar {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const vehicles = useVehicles();
  const stored = useQuery({
    queryKey: qk.activeCar(userId ?? ''),
    queryFn: () => activeCarStore.get(userId!),
    enabled: userId !== null,
    staleTime: Infinity,
  });

  const cars = vehicles.data ?? [];
  const select = (vin: string) => {
    if (userId === null) return;
    queryClient.setQueryData(qk.activeCar(userId), vin);
    void activeCarStore.set(userId, vin);
  };
  const refetch = () => void vehicles.refetch();

  if (vehicles.isError && vehicles.data === undefined) return { status: 'error', car: null, cars, select, refetch };
  if (vehicles.data === undefined || stored.data === undefined) {
    return { status: 'loading', car: null, cars, select, refetch };
  }
  const vin = pickActive(cars, stored.data);
  const car = cars.find((c) => c.vin === vin);
  if (!car) return { status: 'empty', car: null, cars, select, refetch };
  return { status: 'ready', car, cars, select, refetch };
}
