import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { latestOdometer, useTimeline } from '@/features/event';
import { Card, EvidenceBadge, Skeleton, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { StagePlaceholder } from '@/shared/viewer';

import type { VehicleResponse } from '../api/useVehicles';

/** One car in the garage. The stage is the static placeholder: a list never runs a live 3D viewer. */
export function VehicleCard({ vehicle }: { vehicle: VehicleResponse }) {
  const router = useRouter();
  const timeline = useTimeline(vehicle.vin);
  const odometer = timeline.data ? latestOdometer(timeline.data) : undefined;
  const name = `${vehicle.make} ${vehicle.model}`;
  const odometerText = odometer ? en.garage.odometer(odometer.km) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={en.garage.cardLabel(name, odometerText)}
      onPress={() => router.push(`/vehicles/${vehicle.vin}`)}
    >
      <Card style={{ gap: tokens.space['space-3'] }}>
        <View style={{ height: 120, borderRadius: tokens.radius['radius-md'], overflow: 'hidden' }}>
          <StagePlaceholder />
        </View>
        <View style={{ gap: tokens.space['space-1'] }}>
          <Text variant="title-lg">{name}</Text>
          <Text color="ink-muted">{`${vehicle.year} · ${en.fuel[vehicle.fuel]}`}</Text>
          <Text variant="vin-sm" color="ink-muted">
            {vehicle.vin}
          </Text>
        </View>
        {timeline.isPending ? (
          <Skeleton width={160} height={24} />
        ) : odometer ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
            <Text variant="title">{odometerText}</Text>
            <EvidenceBadge evidence={odometer.evidence} />
          </View>
        ) : (
          <Text color="ink-muted">{timeline.isError ? en.garage.odometerUnavailable : en.garage.noEntries}</Text>
        )}
      </Card>
    </Pressable>
  );
}
