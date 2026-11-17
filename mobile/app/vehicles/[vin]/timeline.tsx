import { useRouter } from 'expo-router';

import { AppBar, Screen } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** Placeholder until the full timeline screen lands. */
export default function TimelineRoute() {
  const router = useRouter();
  return <Screen header={<AppBar onBack={() => router.back()} title={en.vehicle.timelineTitle} />}>{null}</Screen>;
}
