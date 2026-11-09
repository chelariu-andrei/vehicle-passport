import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Redirect, SplashScreen, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createAppQueryClient } from '@/shared/api';
import { onSessionEnd, startSession, useSession } from '@/shared/auth/session';
import { fontAssets, OfflineBanner, ThemeProvider, ToastHost, useTheme } from '@/shared/design';

void SplashScreen.preventAutoHideAsync();

function Shell() {
  const { colors, scheme } = useTheme();
  const { status } = useSession();
  const insets = useSafeAreaInsets();
  const inAuth = useSegments()[0] === '(auth)';
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="vehicles/new" options={{ presentation: 'modal' }} />
      </Stack>
      {/* The side of the app follows the session. Both redirects wait until the session is known. */}
      {status === 'signedOut' && !inAuth ? <Redirect href="/sign-in" /> : null}
      {status === 'signedIn' && inAuth ? <Redirect href="/" /> : null}
      <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }}>
        <OfflineBanner />
      </View>
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  // Task 9 makes the car-gone handler real; until then nothing reacts to it.
  const [queryClient] = useState(() => createAppQueryClient({ onVehicleGone: () => undefined }));
  const { status } = useSession();
  const ready = (loaded || error !== null) && status !== 'loading';

  useEffect(() => startSession(), []);
  // The next account on this phone must start from nothing: whatever ends a session also empties the cache.
  useEffect(
    () =>
      onSessionEnd(() => {
        void queryClient.cancelQueries();
        queryClient.clear();
      }),
    [queryClient],
  );
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // A font failure must not trap the user on the splash screen; text falls back to the system font.
  if (!ready) return null;
  return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </QueryClientProvider>
  );
}
