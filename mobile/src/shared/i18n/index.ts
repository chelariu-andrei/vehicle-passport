import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { en } from './en';
import { ro, type DeepPartial } from './ro';

export type Locale = 'ro' | 'en';
export type LanguagePreference = 'system' | Locale;

export type Strings = typeof en;

/** Dotted paths to every plain-text entry of `en` (entries that take arguments are read through `useStrings`). */
type Paths<T, P extends string = ''> = {
  [K in keyof T & (string | number)]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends (...args: never[]) => unknown
      ? never
      : T[K] extends readonly unknown[]
        ? never
        : Paths<T[K], `${P}${K}.`>;
}[keyof T & (string | number)];
export type KeyPath = Paths<Strings>;

export function resolveLocale(pref: LanguagePreference, deviceLocale: string): Locale {
  if (pref !== 'system') return pref;
  return deviceLocale.toLowerCase().startsWith('ro') ? 'ro' : 'en';
}

/** The phone's language, such as "ro-RO". */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

type Tree = Record<string, unknown>;
const isTree = (value: unknown): value is Tree => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every key `over` has wins; everything else is read from `base`. */
function merge(base: Tree, over: Tree): Tree {
  const result: Tree = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    const current = result[key];
    result[key] = isTree(current) && isTree(value) ? merge(current, value) : value;
  }
  return result;
}

const merged: Record<Locale, Strings> = {
  en,
  ro: merge(en as unknown as Tree, ro as DeepPartial<Strings> as Tree) as unknown as Strings,
};

/** The whole text tree for a language, with English where it is not translated. */
export const stringsFor = (locale: Locale): Strings => merged[locale];

export function translate(locale: Locale, key: KeyPath, params?: Record<string, string | number>): string {
  let value: unknown = merged[locale];
  for (const part of key.split('.')) value = isTree(value) ? value[part] : undefined;
  let text = typeof value === 'string' ? value : key;
  if (params) for (const [name, replacement] of Object.entries(params)) text = text.split(`{${name}}`).join(String(replacement));
  return text;
}

const STORAGE_KEY = 'language';
const isPreference = (value: string | null): value is LanguagePreference => value === 'system' || value === 'ro' || value === 'en';

type LocaleValue = {
  locale: Locale;
  preference: LanguagePreference;
  /** The language has been read from this phone, so the server's value must not replace it. */
  hydrated: boolean;
  /** The person (or an earlier sync) chose a language on this phone. */
  stored: boolean;
  setPreference: (preference: LanguagePreference) => void;
};

const LocaleContext = createContext<LocaleValue>({
  locale: 'en',
  preference: 'system',
  hydrated: true,
  stored: false,
  setPreference: () => {},
});

/** The language of the app. The choice is kept on the phone, so it applies at once and without a connection. */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>('system');
  const [hydrated, setHydrated] = useState(false);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!active) return;
        if (isPreference(value)) {
          setPreferenceState(value);
          setStored(true);
        }
      })
      .catch(() => {})
      .finally(() => active && setHydrated(true));
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: LanguagePreference) => {
    setPreferenceState(next);
    setStored(true);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const locale = resolveLocale(preference, deviceLocale());
  const value = useMemo(() => ({ locale, preference, hydrated, stored, setPreference }), [locale, preference, hydrated, stored, setPreference]);
  return createElement(LocaleContext.Provider, { value }, children);
}

export const useLocale = () => useContext(LocaleContext);

/** The translator for the current language. A key missing in Romanian is read in English. */
export function useT(): (key: KeyPath, params?: Record<string, string | number>) => string {
  const { locale } = useLocale();
  return useCallback((key, params) => translate(locale, key, params), [locale]);
}

/** The whole text tree, for entries that take arguments (counts, versions). */
export function useStrings(): Strings {
  return stringsFor(useLocale().locale);
}

/** A validation message from a shared schema (written in English), in the current language. */
export function useValidationMessage(): (message: string | undefined) => string | undefined {
  const { locale } = useLocale();
  return useCallback(
    (message) => {
      if (message === undefined || locale === 'en') return message;
      const key = (Object.keys(en.validation) as (keyof typeof en.validation)[]).find((k) => en.validation[k] === message);
      return key ? stringsFor(locale).validation[key] : message;
    },
    [locale],
  );
}
