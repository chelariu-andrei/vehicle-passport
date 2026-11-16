import type { components } from '@/shared/api/generated/schema';
import { useLocale } from '@/shared/i18n';

export type LegalLocale = components['schemas']['LegalLocale'];

/** The language the legal text is asked for: the app's own. The server falls back to English where a text is not translated. */
export function useLegalLocale(): LegalLocale {
  return useLocale().locale;
}
