import { useLocalSearchParams } from 'expo-router';

import { CaptureScreen } from '@/features/scan';

export default function NewScanRoute() {
  const { vin } = useLocalSearchParams<{ vin?: string }>();
  return <CaptureScreen vin={vin} />;
}
