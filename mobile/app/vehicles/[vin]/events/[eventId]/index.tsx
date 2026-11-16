import { useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/features/event';

export default function EventDetailRoute() {
  const { vin, eventId } = useLocalSearchParams<{ vin: string; eventId: string }>();
  return <EventDetailScreen vin={vin} eventId={eventId} />;
}
