import { useLocalSearchParams } from 'expo-router';

import { FuelFormScreen } from '@/features/fuel';
import { useVehicle } from '@/features/vehicle';

export default function NewFuelEntryRoute() {
  const { vin } = useLocalSearchParams<{ vin: string }>();
  const vehicle = useVehicle(vin);
  return <FuelFormScreen vin={vin} vehicleFuel={vehicle.data?.fuel} vehicleFailed={vehicle.isError} onRetryVehicle={() => void vehicle.refetch()} />;
}
