import { useLocalSearchParams } from 'expo-router';

import { EventFormScreen, parsePreset } from '@/features/event';

export default function NewEventRoute() {
  const { vin, ...params } = useLocalSearchParams<{ vin: string; type?: string; coverage?: string; item?: string }>();
  return <EventFormScreen vin={vin} preset={parsePreset(params)} />;
}
