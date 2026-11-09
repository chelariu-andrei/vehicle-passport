import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

export type ScanWarning = components['schemas']['ScanWarning'];
export type WarnedField = 'date' | 'odometerKm';

const FIELD_OF: Record<string, WarnedField> = { ODOMETER_INCONSISTENT: 'odometerKm', DATE_IN_FUTURE: 'date' };

/** The field a warning belongs to, if it names one. Those are shown on the field, the rest at the top. */
export const warningField = (w: ScanWarning): WarnedField | undefined => FIELD_OF[w.code];

/** Catalog copy for the codes we know (P8); the server's message for any new one. */
export function warningText(w: ScanWarning): string {
  const known = (en.scans.review.warnings as Record<string, string | undefined>)[w.code];
  return known ?? w.message;
}
