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
  setPreference: (preference: Preference) => void;
};

const STORAGE_KEY = 'appearance';

const ThemeContext = createContext<Theme>({
  colors: tokens.color.dark,
  scheme: 'dark',
  preference: 'system',
  setPreference: () => {},
});

const isPreference = (value: string | null): value is Preference =>
  value === 'system' || value === 'dark' || value === 'light';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<Preference>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: Preference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const scheme: ThemeId = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(
    () => ({ colors: tokens.color[scheme], scheme, preference, setPreference }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
