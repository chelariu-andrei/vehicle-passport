import { en } from '@/shared/i18n/en';

import type { components } from '@/shared/api/generated/schema';

export type LegalType = components['schemas']['LegalDocumentType'];

export const LEGAL_TYPES: readonly LegalType[] = ['terms', 'privacy', 'data-sharing'];

export const isLegalType = (value: unknown): value is LegalType => LEGAL_TYPES.some((t) => t === value);

const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "Version 1.0 · effective 1 Jan 2026" */
export const versionLine = (version: string, effectiveDate: string) => en.legal.versionLine(version, formatDate(effectiveDate));
