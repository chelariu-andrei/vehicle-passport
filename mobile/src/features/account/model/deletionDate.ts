import type { Locale } from '@/shared/i18n';

/** The day the account is deleted on, written in the person's language (day, month, year; their time zone). */
export function formatDeletionDate(locale: Locale, iso: string): string {
  return new Date(iso).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
