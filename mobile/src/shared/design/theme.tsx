import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { tokens, type ThemeId } from './tokens.generated';

export type Preference = 'system' | 'dark' | 'light';
export type Colors = (typeof tokens.color)[ThemeId];

type Theme = {
  colors: Colors;
  scheme: ThemeId;
  preference: Preference;
  /** The choice has been read from this phone. */
  hydrated: boolean;
  /** The person chose an appearance on this phone, so the server's must not replace it. */
  stored: boolean;
  setPreference: (preference: Preference) => void;
};

const STORAGE_KEY = 'appearance';

const ThemeContext = createContext<Theme>({
  colors: tokens.color.dark,
  scheme: 'dark',
  preference: 'system',
  hydrated: true,
  stored: false,
  setPreference: () => {},
});

const isPreference = (value: string | null): value is Preference =>
  value === 'system' || value === 'dark' || value === 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<Preference>('system');
  const [hydrated, setHydrated] = useState(false);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isPreference(stored)) {
          setPreferenceState(stored);
          setStored(true);
        }
      })
      .catch(() => {})
      .finally(() => active && setHydrated(true));
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: Preference) => {
    setPreferenceState(next);
    setStored(true);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme: ThemeId = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(
    () => ({ colors: tokens.color[scheme], scheme, preference, hydrated, stored, setPreference }),
    [scheme, preference, hydrated, stored, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
