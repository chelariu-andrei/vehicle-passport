import { useLocalSearchParams } from 'expo-router';

import { TimelineScreen } from '@/features/event';
import { useVehicle } from '@/features/vehicle';

export default function TimelineRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const vehicle = useVehicle(vin);
  const carName = vehicle.data ? `${vehicle.data.make} ${vehicle.data.model}` : undefined;
  return <TimelineScreen vin={vin} carName={carName} />;
}
