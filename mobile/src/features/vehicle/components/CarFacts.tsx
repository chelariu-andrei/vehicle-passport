import { View } from 'react-native';

import { latestOdometer, useTimeline } from '@/features/event';
import { EvidenceBadge, Skeleton, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { VehicleResponse } from '../api/useVehicles';

/** Year, fuel and engine on the left; the latest odometer and the badge of the entry it came from on the right. */
export function CarFacts({ car }: { car: VehicleResponse }) {
  const timeline = useTimeline(car.vin);
  const odometer = timeline.data ? latestOdometer(timeline.data) : undefined;
  const facts = [String(car.year), en.fuel[car.fuel], ...(car.engine ? [car.engine] : [])].join(' · ');

  return (
    <View testID="car-facts" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: tokens.space['space-3'] }}>
      <Text color="ink-muted" style={{ flexShrink: 1 }}>
        {facts}
      </Text>
      {timeline.isPending ? (
        <Skeleton width={120} height={24} />
      ) : odometer ? (
        <View style={{ alignItems: 'flex-end', gap: tokens.space['space-1'] }}>
          <Text variant="title">{en.garage.odometer(odometer.km)}</Text>
          <EvidenceBadge evidence={odometer.evidence} />
        </View>
      ) : (
        <Text color="ink-muted">{timeline.isError ? en.garage.odometerUnavailable : en.garage.noEntries}</Text>
      )}
    </View>
  );
}
