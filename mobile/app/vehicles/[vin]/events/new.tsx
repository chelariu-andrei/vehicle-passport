import { useLocalSearchParams } from 'expo-router';

import { EventFormScreen } from '@/features/event';

export default function NewEventRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <EventFormScreen vin={vin} />;
}
