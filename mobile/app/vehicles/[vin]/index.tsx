import { useLocalSearchParams } from 'expo-router';

import { VehicleDetailScreen } from '@/features/vehicle';

export default function VehicleRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <VehicleDetailScreen vin={vin} />;
}
