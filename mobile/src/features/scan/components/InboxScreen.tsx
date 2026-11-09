import { useRouter } from 'expo-router';

import { useVehicles } from '@/features/vehicle';
import { AsyncList, Button, EmptyState, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useScanJobs } from '../api/useScanJobs';
import { InboxRow } from './InboxRow';

export function InboxScreen() {
  const router = useRouter();
  const vehicles = useVehicles();
  const { rows, dismiss, retry, isRetrying, query } = useScanJobs();
  const startScan = () => router.push('/scans/new');
  const nameOf = (vin: string) => {
    const car = vehicles.data?.find((v) => v.vin === vin);
    return car ? `${car.make} ${car.model}` : vin;
  };

  return (
    <Screen>
      <Text variant="display-xl" accessibilityRole="header">
        {en.scans.title}
      </Text>
      {rows.length > 0 ? <Button title={en.scans.scanInvoice} onPress={startScan} /> : null}
      <AsyncList
        query={query}
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
