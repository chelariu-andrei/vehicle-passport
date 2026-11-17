import { useIsFocused, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { DeadlinesBell } from '@/features/deadlines';
import { HistoryList } from '@/features/event';
import { errorMessage, forgetVehicle, useRefetchOnFocus } from '@/shared/api';
import {
  ActionBar,
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  Skeleton,
  Text,
  toast,
  tokens,
  useTheme,
} from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { goToGarage } from '@/shared/navigation/goToGarage';
import { CarSilhouette, CarViewer, NEUTRAL_LOOK, hasLook, lookOf } from '@/shared/viewer';

import { useActiveCar } from '../api/useActiveCar';
import { useClaims } from '../api/useClaims';
import { useLocalClaims } from '../api/useLocalClaims';
import { useSaveColour } from '../api/useSaveColour';
import { useReleaseVehicle } from '../api/useReleaseVehicle';
import { useVehicle, useVehicles } from '../api/useVehicles';
import type { VehicleResponse } from '../api/useVehicles';
import { autoJourney } from '../model/autoJourney';
import { migrateColour } from '../model/migrateColour';
import { CarFacts } from './CarFacts';
import { CarSwitcher } from './CarSwitcher';
import { ClaimsBanner } from './ClaimsBanner';
import { MakeItYoursRow } from './look/MakeItYoursRow';
import { PendingClaimRow } from './PendingClaimRow';

const STAGE_SHARE = 0.3;
const DISMISS_FALLBACK_MS = 350;

type MenuItem = { title: string; onPress: () => void; danger?: boolean };

/** The overflow sheet. It closes by tapping outside; every item is a full-width 48 point row. */
function OverflowMenu({ visible, items, onClose }: { visible: boolean; items: MenuItem[]; onClose: () => void }) {
  const { colors, scheme } = useTheme();
  // The chosen action waits until this modal has gone: iOS can drop a modal presented while another is dismissing.
  const pending = useRef<(() => void) | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  // iOS reports the end of the dismissal through `onDismiss`, and a timer there could present mid-dismissal, so it
  // waits for that alone. Elsewhere `onDismiss` never fires, so a short timer stands in. Reopening drops a stale action.
  useEffect(() => {
    if (visible) {
      pending.current = null;
      return;
    }
    if (Platform.OS === 'ios' || !pending.current) return;
    const timer = setTimeout(runPending, DISMISS_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={runPending}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityLabel={en.common.dismiss} style={{ flex: 1 }} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: tokens.radius['radius-lg'],
            borderTopRightRadius: tokens.radius['radius-lg'],
            padding: tokens.space['space-3'],
            boxShadow: tokens.shadow[scheme]['shadow-card'],
          }}
        >
          {items.map((item) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => {
                pending.current = item.onPress;
                onClose();
              }}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: tokens.space['space-3'] }}
            >
              <Text variant="body-lg" color={item.danger ? 'danger' : 'ink'}>
                {item.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.space['space-4'],
        gap: tokens.space['space-2'],
      }}
    >
      <View style={{ flex: 1 }}>
        <CarSwitcher fallbackTitle={en.cars.emptyTitle} />
      </View>
      {right}
    </View>
  );
}

function ActiveCar({ car, onlyCar }: { car: VehicleResponse; onlyCar: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  // The car read on its own, so a car the server stopped listing for this account is noticed (and announced) here.
  const vehicle = useVehicle(car.vin);
  const claims = useClaims(car.vin);
  const release = useReleaseVehicle(car.vin);
  const saveColour = useSaveColour(car.vin);
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  useRefetchOnFocus(vehicle.refetch);
  useRefetchOnFocus(claims.refetch);

  const shown = vehicle.data ?? car;
  const vin = shown.vin;
  const pending = claims.data?.length ?? 0;

  // A colour chosen before the look lived on the server moves there once.
  const looked = hasLook(shown);
  const { mutateAsync: sendColour } = saveColour;
  useEffect(() => {
    void migrateColour(vin, looked, sendColour);
  }, [vin, looked, sendColour]);

  const giveUp = () => {
    if (release.isPending) return;
    release.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        // Leave first, so the screen is not mounted on queries that are about to be removed.
        goToGarage();
        forgetVehicle(queryClient, vin);
      },
      onError: (error) => {
        setConfirming(false);
        toast(errorMessage(error));
      },
    });
  };

  const items: MenuItem[] = [
    { title: en.vehicle.edit, onPress: () => router.push(`/vehicles/${vin}/edit`) },
    { title: en.look.change, onPress: () => router.push(`/vehicles/${vin}/look`) },
    { title: en.vehicle.release, onPress: () => setConfirming(true), danger: true },
    // With one car the title opens nothing, so adding another lives here.
    ...(onlyCar ? [{ title: en.cars.add, onPress: () => router.push('/onboarding') }] : []),
  ];

  return (
    <Screen
      scroll
      header={
        <Header
          right={
            <>
              <DeadlinesBell vin={vin} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={en.vehicle.more}
                onPress={() => setMenu(true)}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="more" />
              </Pressable>
            </>
          }
        />
      }
      footer={<ActionBar primary={{ title: en.vehicle.scanInvoice, onPress: () => router.push(`/scans/new?vin=${vin}`) }} />}
    >
      {/* The stage never gates the rest of the screen: it shows a still until the 3D is ready. */}
      <View style={{ height: height * STAGE_SHARE, borderRadius: tokens.radius['radius-lg'], overflow: 'hidden' }}>
        <CarViewer look={lookOf(shown)} active={focused} />
      </View>
      <Text variant="caption" color="ink-muted" style={{ textAlign: 'center' }}>
        {en.vehicle.illustrative}
      </Text>

      {hasLook(shown) ? null : <MakeItYoursRow vin={vin} />}

      <CarFacts car={shown} />

      {pending > 0 ? <ClaimsBanner count={pending} onReview={() => router.push(`/vehicles/${vin}/claims`)} /> : null}

      <View style={{ flexDirection: 'row', gap: tokens.space['space-3'] }}>
        <View style={{ flex: 1 }}>
          <Button kind="secondary" title={en.vehicle.addEvent} onPress={() => router.push(`/vehicles/${vin}/events/new`)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button kind="secondary" title={en.vehicle.createPassport} onPress={() => router.push(`/vehicles/${vin}/passports/new`)} />
        </View>
      </View>

      <HistoryList vin={vin} />

      <OverflowMenu visible={menu} items={items} onClose={() => setMenu(false)} />
      <ConfirmSheet
        visible={confirming}
        title={en.vehicle.releaseTitle}
        body={en.vehicle.releaseBody}
        confirmLabel={en.vehicle.releaseConfirm}
        dismissLabel={en.vehicle.releaseKeep}
        danger
        onConfirm={giveUp}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}

/** The Car tab: the active car's detail. */
export function CarHomeScreen() {
  const router = useRouter();
  const active = useActiveCar();
  const vehicles = useVehicles();
  const claims = useLocalClaims(vehicles.data?.map((v) => v.vin));
  const focused = useIsFocused();

  // An empty garage with nothing on its way opens the add-a-car journey, unless "Later" was chosen this launch.
  const claimsLoaded = claims.data !== undefined;
  const claimCount = claims.data?.length ?? 0;
  useEffect(() => {
    if (focused && autoJourney.shouldStart({ status: active.status, claimsLoaded, claimCount })) router.push('/onboarding?auto=1');
  }, [focused, active.status, claimsLoaded, claimCount, router]);

  if (active.status === 'ready') {
    // Keyed by VIN so a switch starts the new car's queries and focus handling from scratch.
    return <ActiveCar key={active.car.vin} car={active.car} onlyCar={active.cars.length === 1} />;
  }
  if (active.status === 'error') {
    return (
      <Screen header={<Header />}>
        <ErrorState onRetry={active.refetch} />
      </Screen>
    );
  }
  if (active.status === 'loading') {
    return (
      <Screen header={<Header />}>
        <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-4'] }}>
          <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
            <CarSilhouette look={NEUTRAL_LOOK} width={240} />
          </View>
          <Skeleton height={24} width="70%" />
          <Skeleton height={20} width="50%" />
        </View>
      </Screen>
    );
  }
  // No cars. A claim this phone filed is the only sign of one on the way, so it shows here too.
  return (
    <Screen scroll header={<Header />}>
      <EmptyState
        title={en.garage.emptyTitle}
        body={en.garage.emptyBody}
        action={{ title: en.cars.add, onPress: () => router.push('/onboarding') }}
      />
      {(claims.data ?? []).map((claim) => (
        <PendingClaimRow key={claim.claimId} claim={claim} />
      ))}
    </Screen>
  );
}
