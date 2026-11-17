import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Redirect, SplashScreen, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLockBoundary, BiometricOfferSheet, sweepStaleExport, useConsentGate } from '@/features/account';
import { cancelReminders, ReminderSync, useNotificationTap } from '@/features/deadlines';
import { SettingsSync } from '@/features/settings';
import { autoJourney } from '@/features/vehicle';
import { createAppQueryClient, forgetVehicle } from '@/shared/api';
import { onSessionEnd, signOut, startSession, useSession } from '@/shared/auth/session';
import { Button, ErrorState, fontAssets, Ground, OfflineBanner, Screen, ThemeProvider, toast, ToastHost, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { LocaleProvider, useStrings } from '@/shared/i18n';
import { goToGarage } from '@/shared/navigation/goToGarage';

void SplashScreen.preventAutoHideAsync();

/**
 * The app opens only once the account says the current terms are accepted. Until then it is covered: by a spinner while the
 * account loads, by a retry screen when it cannot be reached (never by the app, never by an automatic acceptance).
 */
function ConsentGuard({ segments }: { segments: string[] }) {
  const { gate, retry } = useConsentGate();
  const s = useStrings();
  const onConsent = segments[0] === 'consent';
  // The terms themselves must stay readable from the gate.
  const readingLegal = segments[0] === 'account' && segments[1] === 'legal';
  if (gate === 'open') return onConsent ? <Redirect href="/" /> : null;
  if (gate === 'loading' || gate === 'error') {
    return (
      <View style={StyleSheet.absoluteFill}>
        {gate === 'loading' ? (
          <Ground>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator accessibilityLabel={s.consent.loading} />
            </View>
          </Ground>
        ) : (
          <Screen>
            <ErrorState title={s.consent.retryTitle} onRetry={retry} />
            <Button kind="quiet" title={s.consent.signOut} onPress={() => void signOut()} />
          </Screen>
        )}
      </View>
    );
  }
  return onConsent || readingLegal ? null : <Redirect href="/consent" />;
}

function Shell() {
  const { colors, scheme } = useTheme();
  const { status, userId } = useSession();
  const insets = useSafeAreaInsets();
  const segments: string[] = useSegments();
  const inAuth = segments[0] === '(auth)';
  // The reset link signs the person in (a recovery session); they stay here until the new password is set.
  const resettingPassword = inAuth && segments[1] === 'reset-password';
  // A tapped reminder opens its car's Document status.
  useNotificationTap();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="scans/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vehicles/[vin]/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vehicles/[vin]/passports/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vehicles/[vin]/events/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vehicles/[vin]/events/[eventId]/edit" options={{ presentation: 'modal' }} />
      </Stack>
      {/* The side of the app follows the session. Both redirects wait until the session is known. */}
      {status === 'signedOut' && !inAuth ? <Redirect href="/sign-in" /> : null}
      {status === 'signedIn' && inAuth && !resettingPassword ? <Redirect href="/" /> : null}
      {status === 'signedIn' && !resettingPassword ? <ConsentGuard segments={segments} /> : null}
      {status === 'signedIn' ? <SettingsSync /> : null}
      {/* Keyed by account, so a different account on this phone starts from its own plan. */}
      {status === 'signedIn' ? <ReminderSync key={userId} /> : null}
      {status === 'signedIn' && !resettingPassword ? <BiometricOfferSheet /> : null}
      <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0 }}>
        <OfflineBanner />
      </View>
      <ToastHost />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts(fontAssets);
  // A car the server no longer lists for this account (transfer or release) is dropped, and the user is told (integration 2.3).
  const [queryClient] = useState(() => {
    const client: QueryClient = createAppQueryClient({
      onVehicleGone: (vin) => {
        forgetVehicle(client, vin);
        goToGarage();
        toast(en.vehicle.gone);
      },
    });
    return client;
  });
  const { status } = useSession();
  const ready = (loaded || error !== null) && status !== 'loading';

  useEffect(() => startSession(), []);
  // An export left from an earlier run (the app was closed while sharing) is removed as the app opens.
  useEffect(() => sweepStaleExport(), []);
  // The next account on this phone must start from nothing: whatever ends a session also empties the cache.
  useEffect(
    () =>
      onSessionEnd(() => {
        void queryClient.cancelQueries();
        queryClient.clear();
        // The next account on this phone is offered the journey afresh.
        autoJourney.reset();
        // Reminders belong to the account that scheduled them.
        void cancelReminders();
      }),
    [queryClient],
  );
  // Nobody is signed in (also when a session was lost while the app was closed): no reminders may stay behind.
  useEffect(() => {
    if (status === 'signedOut') void cancelReminders();
  }, [status]);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // A font failure must not trap the user on the splash screen; text falls back to the system font.
  if (!ready) return null;
  return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocaleProvider>
            <AppLockBoundary>
              <Shell />
            </AppLockBoundary>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
  );
}
