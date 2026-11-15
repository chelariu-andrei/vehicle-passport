import { useLocalSearchParams } from 'expo-router';

import { JourneyScreen } from './JourneyScreen';

/** `/onboarding` is the add-a-car journey; `?auto=1` means the app opened it by itself. */
export function OnboardingRoute() {
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  return <JourneyScreen auto={auto === '1'} />;
}
