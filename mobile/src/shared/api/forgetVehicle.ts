import type { QueryClient } from '@tanstack/react-query';

import { expectDeparture } from './queryClient';
import { qk } from './queryKeys';

/** Drops everything cached for a car that has left this account, takes it off the cached garage list and refreshes that list. */
export function forgetVehicle(queryClient: QueryClient, vin: string): void {
  expectDeparture(queryClient, vin);
  queryClient.removeQueries({ queryKey: qk.vehicle(vin) });
  queryClient.removeQueries({ queryKey: qk.timeline(vin) });
  queryClient.removeQueries({ queryKey: qk.claims(vin) });
  // Take it off the cached garage list now, so whatever follows the active car moves on before the refetch lands.
  queryClient.setQueryData<{ vin: string }[]>(qk.vehicles, (cars) => cars?.filter((car) => car.vin !== vin));
  void queryClient.invalidateQueries({ queryKey: qk.vehicles });
}
