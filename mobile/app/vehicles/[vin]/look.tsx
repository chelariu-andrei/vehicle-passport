import { useLocalSearchParams } from 'expo-router';

import { LookScreen } from '@/features/vehicle';

export default function LookRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <LookScreen vin={vin} />;
}
