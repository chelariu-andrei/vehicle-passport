import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { CarSwitcher, useActiveCar, useVehicles } from '@/features/vehicle';
import { AsyncList, Button, EmptyState, Screen, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useScanJobs } from '../api/useScanJobs';
import { InboxRow } from './InboxRow';

export function InboxScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const active = useActiveCar();
  const car = active.car;
  const { rows: allRows, dismiss, retry, isRetrying, query } = useScanJobs();
  const rows = car ? allRows.filter((row) => row.vin === car.vin) : [];
  const startScan = () => router.push('/scans/new');
  const nameOf = (vin: string) => {
    const car = vehicles.data?.find((v) => v.vin === vin);
    return car ? `${car.make} ${car.model}` : vin;
  };

  return (
    <Screen
      header={
        <View style={{ minHeight: 56, justifyContent: 'center', paddingHorizontal: tokens.space['space-4'] }}>
          <CarSwitcher fallbackTitle={en.scans.title} />
        </View>
      }
    >
      {rows.length > 0 ? <Button title={en.scans.scanInvoice} onPress={startScan} /> : null}
      <AsyncList
        query={{
          isPending: query.isPending || active.status === 'loading',
          isError: query.isError || active.status === 'error',
          isRefetching: query.isRefetching,
          refetch: () => {
            void query.refetch();
            active.refetch();
          },
        }}
        data={rows}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) => (
          <InboxRow
            row={item}
            vehicleName={nameOf(item.vin)}
            busy={isRetrying}
            onReview={() => router.push(`/scans/${item.id}`)}
            onRetry={() => retry(item.id)}
            onEnterByHand={() => router.push(`/vehicles/${item.vin}/events/new`)}
            onDismiss={() => dismiss(item.id)}
          />
        )}
        empty={
          <EmptyState
            icon="scan"
            title={en.scans.emptyTitle}
            body={en.scans.emptyBody}
            action={{ title: en.scans.scanInvoice, onPress: startScan }}
          />
        }
      />
    </Screen>
  );
}
