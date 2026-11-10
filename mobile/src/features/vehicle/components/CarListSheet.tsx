import { useRouter } from 'expo-router';
import { AccessibilityInfo, Modal, Pressable, ScrollView, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { CarSilhouette, lookOf } from '@/shared/viewer';

import { useActiveCar } from '../api/useActiveCar';
import { useLocalClaims } from '../api/useLocalClaims';
import { useVehicles } from '../api/useVehicles';
import { PendingClaimRow } from './PendingClaimRow';

/** What the car shows under its name: the plate, or the VIN when it has none. */
export const plateOrVin = (car: { plate?: string | null; vin: string }) => car.plate ?? car.vin;

/**
 * "Your cars": one row per car, then claims still waiting, then "Add a car". Rows draw the static silhouette;
 * the one live stage belongs to the Car tab. Closes by tapping outside.
 */
export function CarListSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const { car: active, cars, select } = useActiveCar();
  const vehicles = useVehicles();
  const claims = useLocalClaims(vehicles.data?.map((v) => v.vin));

  const choose = (vin: string, name: string) => {
    select(vin);
    onClose();
    AccessibilityInfo.announceForAccessibility(en.cars.nowShowing(name));
  };
  const add = () => {
    onClose();
    router.push('/onboarding');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim }}>
        <Pressable accessibilityLabel={en.common.dismiss} style={{ flex: 1 }} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '80%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: tokens.radius['radius-lg'],
            borderTopRightRadius: tokens.radius['radius-lg'],
            padding: tokens.space['space-5'],
            gap: tokens.space['space-3'],
            boxShadow: tokens.shadow[scheme]['shadow-card'],
          }}
        >
          <Text variant="title-lg" accessibilityRole="header">
            {en.cars.title}
          </Text>
          <ScrollView contentContainerStyle={{ gap: tokens.space['space-2'] }}>
            {cars.map((car) => {
              const name = `${car.make} ${car.model}`;
              const selected = car.vin === active?.vin;
              return (
                <Pressable
                  key={car.vin}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}, ${plateOrVin(car)}`}
                  accessibilityState={{ selected }}
                  onPress={() => choose(car.vin, name)}
                  style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}
                >
                  <CarSilhouette look={lookOf(car)} width={80} />
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{name}</Text>
                    <Text variant="vin-sm" color="ink-muted">
                      {plateOrVin(car)}
                    </Text>
                  </View>
                  {/* The tick says "active" without relying on colour. */}
                  {selected ? <Icon name="check" color="brand" /> : null}
                </Pressable>
              );
            })}
            {(claims.data ?? []).map((claim) => (
              <PendingClaimRow key={claim.claimId} claim={claim} />
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={en.cars.add}
              onPress={add}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}
            >
              <Icon name="plus" />
              <Text variant="title">{en.cars.add}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
