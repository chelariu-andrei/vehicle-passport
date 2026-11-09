import type { QueryClient } from '@tanstack/react-query';

import { expectDeparture } from './queryClient';
import { qk } from './queryKeys';

/** Drops everything cached for a car that has left this account, and refreshes the garage list. */
export function forgetVehicle(queryClient: QueryClient, vin: string): void {
  expectDeparture(queryClient, vin);
  queryClient.removeQueries({ queryKey: qk.vehicle(vin) });
  queryClient.removeQueries({ queryKey: qk.timeline(vin) });
  queryClient.removeQueries({ queryKey: qk.claims(vin) });
  void queryClient.invalidateQueries({ queryKey: qk.vehicles });
}
