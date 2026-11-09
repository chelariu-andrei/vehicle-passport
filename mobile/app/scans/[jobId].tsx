import { useLocalSearchParams } from 'expo-router';

import { ReviewScreen } from '@/features/scan';

export default function ReviewRoute() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return <ReviewScreen jobId={jobId} />;
}
