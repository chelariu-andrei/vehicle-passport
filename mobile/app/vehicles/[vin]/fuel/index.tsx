import { useLocalSearchParams } from 'expo-router';

import { FuelScreen } from '@/features/fuel';

export default function FuelRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <FuelScreen vin={vin} />;
}
