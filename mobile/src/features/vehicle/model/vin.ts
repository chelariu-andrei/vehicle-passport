import { WMI } from './wmi';

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Upper-cases, keeps only characters a VIN may hold (no I, O, Q) and cuts to 17. */
export function cleanVin(text: string): string {
  return text.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
}

export function isVin(text: string): boolean {
  return VIN.test(text);
}

/** The make the first three characters point to, or null under three characters or for an unknown maker. */
export function makeFromVin(vin: string): string | null {
  if (vin.length < 3) return null;
  return WMI[vin.slice(0, 3).toUpperCase()] ?? null;
}
