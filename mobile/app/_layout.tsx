import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { fontAssets, ThemeProvider, ToastHost, useTheme } from '@/shared/design';

void SplashScreen.preventAutoHideAsync();

function Shell() {
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  const ready = loaded || error !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // A font failure must not trap the user on the splash screen; text falls back to the system font.
  if (!ready) return null;
  return (
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
