import { useLocalSearchParams } from 'expo-router';

import { FuelFormScreen } from '@/features/fuel';
import { useVehicle } from '@/features/vehicle';

export default function EditFuelEntryRoute() {
  const { vin, entryId } = useLocalSearchParams<{ vin: string; entryId: string }>();
  const vehicle = useVehicle(vin);
  return (
    <FuelFormScreen vin={vin} entryId={entryId} vehicleFuel={vehicle.data?.fuel} vehicleFailed={vehicle.isError} onRetryVehicle={() => void vehicle.refetch()} />
  );
}
