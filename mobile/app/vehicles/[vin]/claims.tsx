import { useLocalSearchParams } from 'expo-router';

import { ClaimsScreen } from '@/features/vehicle';

export default function ClaimsRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <ClaimsScreen vin={vin} />;
}
