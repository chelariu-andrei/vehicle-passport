import { useLocalSearchParams } from 'expo-router';

import { EventFormScreen } from '@/features/event';

export default function EditEventRoute() {
  const { vin, eventId } = useLocalSearchParams<{ vin: string; eventId: string }>();
  return <EventFormScreen vin={vin} eventId={eventId} />;
}
