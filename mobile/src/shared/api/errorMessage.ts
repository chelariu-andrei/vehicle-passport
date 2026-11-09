import { en } from '../i18n/en';
import { ApiError } from './apiError';

/** User-facing text for any failure. Branches on `code` only; `detail` is never shown. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return en.errors.network;
  if (e.code === null) return en.errors.generic;
  const message = (en.errors.codes as Record<string, string | undefined>)[e.code];
  if (message === undefined) {
    if (!en.errors.behaviourOnly.includes(e.code)) console.warn(`Unknown API error code: ${e.code}`);
    return en.errors.generic;
  }
  return message;
}
