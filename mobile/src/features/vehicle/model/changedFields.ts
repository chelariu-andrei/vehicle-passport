import type { components } from '@/shared/api/generated/schema';

import type { VehicleResponse } from '../api/useVehicles';
import type { VehicleFormValues } from './vehicleForm';

export type VehicleForm = VehicleFormValues;
export type UpdateVehicleRequest = components['schemas']['UpdateVehicleRequest'];

/**
 * The fields the form changed, and only those: the contract wants at least one and ignores the rest.
 * The VIN is never sent. A cleared engine goes as '' because the contract's `engine` is not nullable,
 * while the server stores a blank engine as null; a car without an engine and an empty field are the same.
 */
export function changedFields(original: VehicleResponse, form: VehicleForm): Partial<UpdateVehicleRequest> {
  const changes: Partial<UpdateVehicleRequest> = {};
  if (form.make !== original.make) changes.make = form.make;
  if (form.model !== original.model) changes.model = form.model;
  if ((form.engine ?? '') !== (original.engine ?? '')) changes.engine = form.engine ?? '';
  if (form.year !== original.year) changes.year = form.year;
  if (form.fuel !== original.fuel) changes.fuel = form.fuel;
  return changes;
}
