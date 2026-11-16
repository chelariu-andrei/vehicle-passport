import type { components } from '@/shared/api/generated/schema';

export type LegalLocale = components['schemas']['LegalLocale'];

/** The language the legal text is asked for. English only until the i18n runtime lands; the server falls back to English anyway. */
export function currentLocale(): LegalLocale {
  return 'en';
}
