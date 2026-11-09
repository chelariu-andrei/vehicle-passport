/* Builders for contract-valid fixtures. Every field has a plausible default; override what a scenario cares about. */
import type { components } from '@/shared/api/generated/schema';

export type VehicleResponse = components['schemas']['VehicleResponse'];
export type EventResponse = components['schemas']['EventResponse'];
export type PendingClaimResponse = components['schemas']['PendingClaimResponse'];
export type PassportResponse = components['schemas']['PassportResponse'];
export type ScanJobResponse = components['schemas']['ScanJobResponse'];

export const SAMPLE_VIN = 'WVWZZZ1JZXW000001';

const uuid = () => globalThis.crypto.randomUUID();

export function aVehicle(o: Partial<VehicleResponse> = {}): VehicleResponse {
  return {
    vin: SAMPLE_VIN,
    make: 'Volkswagen',
    model: 'Golf',
    engine: '1.6 TDI',
    year: 2015,
    fuel: 'DIESEL',
    ...o,
  };
}

export function anEvent(o: Partial<EventResponse> = {}): EventResponse {
  return {
    id: uuid(),
    type: 'SERVICE',
    date: '2024-03-10',
    odometerKm: 84200,
    costAmount: 350,
    currency: 'RON',
    notes: null,
    details: null,
    evidence: 'USER_CONFIRMED',
    source: 'MANUAL',
    documentPresent: false,
    ...o,
  };
}

export function aClaim(o: Partial<PendingClaimResponse> = {}): PendingClaimResponse {
  return { claimId: uuid(), filedAt: '2025-01-15T10:00:00Z', ...o };
}

export function aPassport(o: Partial<PassportResponse> = {}): PassportResponse {
  const id = o.id ?? uuid();
  return {
    id,
    vin: SAMPLE_VIN,
    publicUrl: `https://passports.example.com/public/passports/${id.replaceAll('-', '')}`,
    hash: 'a'.repeat(64),
    status: 'ACTIVE',
    createdAt: '2025-01-15T10:00:00Z',
    expiresAt: null,
    ...o,
  };
}

export function aScanJob(o: Partial<ScanJobResponse> = {}): ScanJobResponse {
  return { id: uuid(), status: 'PENDING', fields: null, warnings: [], ...o };
}
