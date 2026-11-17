import type { components } from '@/shared/api/generated/schema';

import type { FuelEntryType, FuelFormState } from './fuelForm';

type VehicleFuelType = components['schemas']['FuelType'];
type FuelEntryResponse = components['schemas']['FuelEntryResponse'];

const ALL: FuelEntryType[] = ['PETROL', 'DIESEL', 'LPG', 'ELECTRIC'];

/** Which fuels the form offers for a car. One option means the selector is hidden. */
export function fuelTypeChoice(vehicleFuel: VehicleFuelType): { options: FuelEntryType[]; default: FuelEntryType | null } {
  switch (vehicleFuel) {
    case 'PETROL':
    case 'DIESEL':
    case 'LPG':
    case 'ELECTRIC':
      return { options: [vehicleFuel], default: vehicleFuel };
    case 'HYBRID':
      return { options: ['PETROL', 'ELECTRIC'], default: 'PETROL' };
    case 'OTHER':
      return { options: ALL, default: null };
  }
}

type InitialArgs = {
  vehicleFuel: VehicleFuelType;
  lastEntry: FuelEntryResponse | null;
  lastKm: number | null;
  today: string;
};

/** A new fill-up: today, the last known km, the car's fuel, and the last entry's currency and station. */
export function initialForm({ vehicleFuel, lastEntry, lastKm, today }: InitialArgs): FuelFormState {
  const choice = fuelTypeChoice(vehicleFuel);
  const remembered = lastEntry && choice.options.includes(lastEntry.fuelType) ? lastEntry.fuelType : null;
  return {
    date: today,
    odometerKm: lastKm === null ? '' : String(lastKm),
    fuelType: remembered ?? choice.default,
    quantity: '',
    unitPrice: '',
    total: '',
    touched: [],
    fullTank: true,
    missedPrevious: false,
    grade: null,
    chargeType: null,
    station: lastEntry?.station ?? '',
    note: '',
    currency: lastEntry?.currency ?? 'RON',
  };
}

/** An existing fill-up as the form edits it. Quantity and total are what was saved, so the price is the computed one. */
export function formOfEntry(entry: FuelEntryResponse): FuelFormState {
  return {
    date: entry.date,
    odometerKm: String(entry.odometerKm),
    fuelType: entry.fuelType,
    quantity: String(entry.quantity),
    unitPrice: String(Math.round(entry.unitPrice * 1000) / 1000),
    total: String(entry.total),
    touched: ['quantity', 'total'],
    fullTank: entry.fullTank,
    missedPrevious: entry.missedPrevious,
    grade: entry.grade ?? null,
    chargeType: entry.chargeType ?? null,
    station: entry.station ?? '',
    note: entry.note ?? '',
    currency: entry.currency,
  };
}
