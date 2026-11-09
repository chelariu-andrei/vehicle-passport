import { useLocalSearchParams } from 'expo-router';

import { PassportDetailScreen } from '@/features/passport';

export default function PassportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PassportDetailScreen id={id} />;
}
