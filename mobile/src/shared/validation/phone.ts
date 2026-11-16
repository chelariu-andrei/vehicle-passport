import { z } from 'zod';

import { en } from '../i18n/en';

/** Strips spaces, dashes and parentheses; a leading `+` is kept. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, '');
}

/** Empty string is valid (clears the phone number). */
export const phoneSchema = z
  .string()
  .refine((v) => v === '' || /^\+[1-9]\d{6,14}$/.test(v), en.validation.phoneInvalid);
