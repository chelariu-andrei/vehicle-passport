import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AsyncList, Button, Screen, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { StagePlaceholder } from '@/shared/viewer';
import { useRefetchOnFocus } from '@/shared/api';

import { useLocalClaims } from '../api/useLocalClaims';
import { useVehicles } from '../api/useVehicles';
import type { VehicleResponse } from '../api/useVehicles';
import type { LocalClaim } from '../model/claimStore';
import { PendingClaimRow } from './PendingClaimRow';
import { VehicleCard } from './VehicleCard';

type Row = { kind: 'car'; vehicle: VehicleResponse } | { kind: 'claim'; claim: LocalClaim };

export function GarageScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  useRefetchOnFocus(vehicles.refetch);
  const claims = useLocalClaims(vehicles.data?.map((v) => v.vin));
  const addVehicle = () => router.push('/vehicles/new');

  // Cars first, then the claims still waiting. The list waits for both so the empty state never flashes.
  const rows: Row[] | undefined = vehicles.data && [
    ...vehicles.data.map((vehicle): Row => ({ kind: 'car', vehicle })),
    ...(claims.data ?? []).map((claim): Row => ({ kind: 'claim', claim })),
  ];
  const query = {
    isPending: vehicles.isPending || (vehicles.isSuccess && claims.isPending),
    isError: vehicles.isError,
    isRefetching: vehicles.isRefetching,
    refetch: vehicles.refetch,
  };

  return (
    <Screen>
      <Text variant="display-xl" accessibilityRole="header">
        {en.garage.title}
      </Text>
      {rows && rows.length > 0 ? <Button title={en.garage.addVehicle} onPress={addVehicle} /> : null}
      <AsyncList
        query={query}
        data={rows}
        keyExtractor={(row) => (row.kind === 'car' ? `car:${row.vehicle.vin}` : `claim:${row.claim.claimId}`)}
        renderItem={({ item }) => (item.kind === 'car' ? <VehicleCard vehicle={item.vehicle} /> : <PendingClaimRow claim={item.claim} />)}
        empty={
          <View style={{ gap: tokens.space['space-4'], paddingTop: tokens.space['space-4'] }}>
            <View style={{ height: 160, borderRadius: tokens.radius['radius-lg'], overflow: 'hidden' }}>
              <StagePlaceholder />
            </View>
            <Text variant="title-lg" accessibilityRole="header" style={{ textAlign: 'center' }}>
              {en.garage.emptyTitle}
            </Text>
            <Text color="ink-muted" style={{ textAlign: 'center' }}>
              {en.garage.emptyBody}
            </Text>
            <Button title={en.garage.addVehicle} onPress={addVehicle} />
          </View>
        }
      />
    </Screen>
  );
}
