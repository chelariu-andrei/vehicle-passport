import { useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/features/event';

export default function EventDetailRoute() {
  const { vin, eventId, failedUploads, duplicateUploads } = useLocalSearchParams<{ vin: string; eventId: string; failedUploads?: string; duplicateUploads?: string }>();
  return <EventDetailScreen vin={vin} eventId={eventId} failedUploads={Number(failedUploads) || 0} duplicateUploads={Number(duplicateUploads) || 0} />;
}
