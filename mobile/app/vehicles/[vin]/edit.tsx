import { useLocalSearchParams } from 'expo-router';

import { EditVehicleScreen } from '@/features/vehicle';

export default function EditVehicleRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  return <EditVehicleScreen vin={vin} />;
}
