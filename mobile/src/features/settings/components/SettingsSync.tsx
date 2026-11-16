import { useEffect, useRef } from 'react';

import { useMe } from '@/features/account';
import { useTheme } from '@/shared/design';
import { useLocale } from '@/shared/i18n';

import { useSettings, useUpdateSettings } from '../api/useSettings';

/**
 * Keeps this phone and the account's settings alike. The phone is what the person sees, offline too: a language or
 * appearance chosen here is sent to the server (once per value, so a refusal does not loop); a phone that never chose
 * adopts the account's.
 */
export function SettingsSync() {
  const me = useMe().data;
  const settings = useSettings(me !== undefined && !me.consent.required).data;
  const { change } = useUpdateSettings();
  const theme = useTheme();
  const locale = useLocale();
  const pushed = useRef<string | null>(null);

  useEffect(() => {
    if (!settings || !theme.hydrated || !locale.hydrated) return;
    if (!theme.stored && settings.appearance !== theme.preference) theme.setPreference(settings.appearance);
    if (!locale.stored && settings.language !== locale.preference) locale.setPreference(settings.language);
    const differs =
      (theme.stored && settings.appearance !== theme.preference) || (locale.stored && settings.language !== locale.preference);
    const key = `${theme.preference}|${locale.preference}`;
    if (differs && pushed.current !== key) {
      pushed.current = key;
      change((current) => ({
        ...current,
        appearance: theme.stored ? theme.preference : current.appearance,
        language: locale.stored ? locale.preference : current.language,
      }));
    }
  }, [settings, theme, locale, change]);

  return null;
}
