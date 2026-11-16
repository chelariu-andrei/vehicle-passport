import { useLocalSearchParams } from 'expo-router';

import { EventDetailScreen } from '@/features/event';

export default function EventDetailRoute() {
  const { vin, eventId, failedUploads, totalUploads, duplicateUploads } = useLocalSearchParams<{ vin: string; eventId: string; failedUploads?: string; totalUploads?: string; duplicateUploads?: string }>();
  return <EventDetailScreen vin={vin} eventId={eventId} failedUploads={Number(failedUploads) || 0} totalUploads={Number(totalUploads) || 0} duplicateUploads={Number(duplicateUploads) || 0} />;
}
