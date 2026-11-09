import { useLocalSearchParams } from 'expo-router';

import { CreatePassportScreen } from '@/features/passport';

export default function CreatePassportRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <CreatePassportScreen vin={vin} />;
}
