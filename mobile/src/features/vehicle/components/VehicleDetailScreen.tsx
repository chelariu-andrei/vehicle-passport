import { useIsFocused, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { errorMessage, forgetVehicle, useRefetchOnFocus } from '@/shared/api';
import { Button, ErrorState, Icon, Screen, Skeleton, Text, toast, tokens, ConfirmSheet, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { goToGarage } from '@/shared/navigation/goToGarage';
import { CarViewer, VIEWER_COLOURS } from '@/shared/viewer';

import { useClaims } from '../api/useClaims';
import { useReleaseVehicle } from '../api/useReleaseVehicle';
import { useVehicle } from '../api/useVehicles';
import { viewerColorStore } from '../model/viewerColorStore';
import { ClaimsBanner } from './ClaimsBanner';

const STAGE_SHARE = 0.4;
const CHIP = 28;
const CHIP_HIT = 48;

/** The paint chosen for this car. Starts at the first colour and switches to the remembered one once it is read. */
function useViewerColour(vin: string) {
  const [hex, setHex] = useState<string>(VIEWER_COLOURS[0].hex);
  useEffect(() => {
    let live = true;
    void viewerColorStore.get(vin).then((saved) => {
      if (live && VIEWER_COLOURS.some((option) => option.hex === saved)) setHex(saved!);
    });
    return () => {
      live = false;
    };
  }, [vin]);
  const choose = (next: string) => {
    setHex(next);
    void viewerColorStore.set(vin, next);
  };
  return [hex, choose] as const;
}

function ColourChips({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={en.vehicle.colours} style={{ flexDirection: 'row' }}>
      {VIEWER_COLOURS.map((option) => {
        const selected = option.hex === value;
        return (
          <Pressable
            key={option.hex}
            accessibilityRole="radio"
            accessibilityLabel={option.name}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.hex)}
            style={{ width: CHIP_HIT, height: CHIP_HIT, alignItems: 'center', justifyContent: 'center' }}
          >
            <View
              style={{
                width: CHIP,
                height: CHIP,
                borderRadius: CHIP / 2,
                backgroundColor: option.hex,
                alignItems: 'center',
                justifyContent: 'center',
                // The ring and the tick say "selected" without relying on colour alone.
                borderWidth: selected ? 3 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
              }}
            >
              {selected ? <Icon name="check" size={14} color="brand" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function VehicleDetailScreen({ vin }: { vin: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  const vehicle = useVehicle(vin);
  const claims = useClaims(vin);
  const release = useReleaseVehicle(vin);
  const [colour, setColour] = useViewerColour(vin);
  const [confirming, setConfirming] = useState(false);
  useRefetchOnFocus(vehicle.refetch);
  useRefetchOnFocus(claims.refetch);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
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

  const car = vehicle.data;
  const pending = claims.data?.length ?? 0;
  const facts = car && [String(car.year), en.fuel[car.fuel], ...(car.engine ? [car.engine] : [])].join(' · ');

  return (
    <Screen scroll>
      <Button kind="secondary" title={en.common.back} onPress={back} />
      {/* The stage fills the top of the screen but never gates the rest: it shows a still until the 3D is ready. */}
      <View style={{ height: height * STAGE_SHARE, borderRadius: tokens.radius['radius-lg'], overflow: 'hidden' }}>
        <CarViewer color={colour} active={focused} />
      </View>
      <ColourChips value={colour} onChange={setColour} />
      <Text variant="caption" color="ink-muted">
        {en.vehicle.illustrative}
      </Text>

      {car ? (
        <View style={{ gap: tokens.space['space-4'] }}>
          <View style={{ gap: tokens.space['space-1'] }}>
            <Text variant="display" accessibilityRole="header">{`${car.make} ${car.model}`}</Text>
            <Text variant="vin" color="ink-muted">
              {car.vin}
            </Text>
            <Text color="ink-muted">{facts}</Text>
          </View>

          {pending > 0 ? <ClaimsBanner count={pending} onReview={() => router.push(`/vehicles/${vin}/claims`)} /> : null}

          <View style={{ gap: tokens.space['space-3'] }}>
            <Button title={en.vehicle.addEvent} onPress={() => router.push(`/vehicles/${vin}/events/new`)} />
            <Button kind="secondary" title={en.vehicle.scanInvoice} onPress={() => router.push(`/scans/new?vin=${vin}`)} />
            <Button kind="secondary" title={en.vehicle.createPassport} onPress={() => router.push(`/vehicles/${vin}/passports/new`)} />
          </View>

          <Text variant="title-lg" accessibilityRole="header">
            {en.vehicle.history}
          </Text>
          {/* Task 10 renders the timeline here: TimelineItem rows, newest first, grouped by year. */}

          <View style={{ gap: tokens.space['space-3'] }}>
            <Button kind="secondary" title={en.vehicle.edit} onPress={() => router.push(`/vehicles/${vin}/edit`)} />
            <Button kind="danger" title={en.vehicle.release} onPress={() => setConfirming(true)} />
          </View>
        </View>
      ) : vehicle.isError ? (
        <ErrorState onRetry={() => void vehicle.refetch()} />
      ) : (
        <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-2'] }}>
          <Skeleton height={32} width="70%" />
          <Skeleton height={20} width="50%" />
        </View>
      )}

      <ConfirmSheet
        visible={confirming}
        title={en.vehicle.releaseTitle}
        body={en.vehicle.releaseBody}
        confirmLabel={en.vehicle.releaseConfirm}
        danger
        onConfirm={giveUp}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
