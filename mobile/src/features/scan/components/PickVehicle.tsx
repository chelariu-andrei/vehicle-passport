import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable } from 'react-native';

import { useVehicles } from '@/features/vehicle';
import { Card, EmptyState, ErrorState, Screen, Skeleton, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** Which car an invoice is for. One car is chosen without asking; none explains that a car is needed (P19). */
export function PickVehicle({ onPick }: { onPick(vin: string): void }) {
  const router = useRouter();
  const vehicles = useVehicles();
  const cars = vehicles.data;
  const only = cars?.length === 1 ? cars[0].vin : null;

  useEffect(() => {
    if (only) onPick(only);
  }, [only, onPick]);

  if (vehicles.isPending || only) {
    return (
      <Screen>
        <Skeleton height={96} />
      </Screen>
    );
  }
  if (!cars) return <ErrorState onRetry={() => void vehicles.refetch()} />;
  if (cars.length === 0) {
    return (
      <Screen>
        <EmptyState
          title={en.scans.needCarTitle}
          body={en.scans.needCarBody}
          action={{ title: en.garage.addVehicle, onPress: () => router.replace('/vehicles/new') }}
        />
      </Screen>
    );
  }
  return (
    <Screen scroll>
      <Text variant="title-lg" accessibilityRole="header">
        {en.scans.pickCar}
      </Text>
      {cars.map((car) => (
        <Pressable
          key={car.vin}
          accessibilityRole="button"
          accessibilityLabel={`${car.make} ${car.model}`}
          onPress={() => onPick(car.vin)}
        >
          <Card>
            <Text variant="title">{`${car.make} ${car.model}`}</Text>
            <Text variant="vin-sm" color="ink-muted">
              {car.vin}
            </Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
