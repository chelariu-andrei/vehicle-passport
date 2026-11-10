import { useLocalSearchParams } from 'expo-router';

import { OpenCarRoute } from '@/features/vehicle';

export default function VehicleRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <OpenCarRoute vin={vin} />;
}
