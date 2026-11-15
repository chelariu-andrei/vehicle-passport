import { useIsFocused } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/shared/api';
import { ActionBar, AppBar, ErrorState, Screen, Skeleton, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { useBack } from '@/shared/navigation/useBack';
import { lookOf } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

import { useSaveLook } from '../../api/useSaveLook';
import { useVehicle } from '../../api/useVehicles';
import type { VehicleResponse } from '../../api/useVehicles';
import { LookEditor } from './LookEditor';

function Editor({ car }: { car: VehicleResponse }) {
  const back = useBack('/');
  const focused = useIsFocused();
  const save = useSaveLook(car.vin);
  const [look, setLook] = useState<Look>(() => lookOf(car));
  return (
    <Screen
      scroll
      header={<AppBar onBack={back} title={en.look.title} />}
      footer={<ActionBar primary={{ title: en.look.save, loading: save.isPending, onPress: () => save.mutate(look, { onSuccess: back }) }} />}
    >
      <LookEditor look={look} onChange={setLook} active={focused} />
      {save.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorMessage(save.error)}
        </Text>
      ) : null}
    </Screen>
  );
}

/** Changing the look of a car that is already in the garage. */
export function LookScreen({ vin }: { vin: string }) {
  const back = useBack('/');
  const vehicle = useVehicle(vin);
  if (vehicle.data) return <Editor key={vehicle.data.vin} car={vehicle.data} />;
  return (
    <Screen header={<AppBar onBack={back} title={en.look.title} />}>
      {vehicle.isError ? <ErrorState onRetry={() => void vehicle.refetch()} /> : <Skeleton height={160} />}
    </Screen>
  );
}
