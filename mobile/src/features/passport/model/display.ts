import type { VehicleResponse } from '@/features/vehicle';
import type { components } from '@/shared/api/generated/schema';

export type PassportResponse = components['schemas']['PassportResponse'];
export type ExpiryChoice = 7 | 30 | 90 | null;

const DAY_MS = 86_400_000;

/** The `expiresAt` to ask for, or null for a passport that does not expire. Whether it has expired is the server's `status`. */
export function expiryFrom(choice: ExpiryChoice, now: Date): string | null {
  return choice === null ? null : new Date(now.getTime() + choice * DAY_MS).toISOString();
}

/** Make and model while the car is in the garage; a sold car's passport stays listed under its VIN. */
export function passportHeader(p: PassportResponse, vehicles: VehicleResponse[]): string {
  const car = vehicles.find((v) => v.vin === p.vin);
  return car ? `${car.make} ${car.model}` : p.vin;
}

/** First and last four characters, upper case. */
export function truncateHash(hex: string): string {
  const upper = hex.toUpperCase();
  return upper.length <= 9 ? upper : `${upper.slice(0, 4)}…${upper.slice(-4)}`;
}

export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
