import { stringsFor, type Locale } from '@/shared/i18n';
import type { components } from '@/shared/api/generated/schema';

export type LegalType = components['schemas']['LegalDocumentType'];

export const LEGAL_TYPES: readonly LegalType[] = ['terms', 'privacy', 'data-sharing'];

export const isLegalType = (value: unknown): value is LegalType => LEGAL_TYPES.some((t) => t === value);

const formatDate = (locale: Locale, isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "Version 1.0 · effective 1 Jan 2026" */
export const versionLine = (locale: Locale, version: string, effectiveDate: string) =>
  stringsFor(locale).legal.versionLine(version, formatDate(locale, effectiveDate));
