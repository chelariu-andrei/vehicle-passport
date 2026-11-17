import { useLocalSearchParams } from 'expo-router';

import { DeadlinesScreen } from '@/features/deadlines';
import { useVehicle } from '@/features/vehicle';

export default function DeadlinesRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const vehicle = useVehicle(vin);
  const carName = vehicle.data ? `${vehicle.data.make} ${vehicle.data.model}` : undefined;
  return <DeadlinesScreen vin={vin} carName={carName} />;
}
