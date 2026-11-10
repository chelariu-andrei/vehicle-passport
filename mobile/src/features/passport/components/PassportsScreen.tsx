import { View } from 'react-native';

import { CarSwitcher, useActiveCar, useVehicles } from '@/features/vehicle';
import { useRefetchOnFocus } from '@/shared/api';
import { AsyncList, EmptyState, Screen, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { usePassports } from '../api/usePassports';
import type { PassportResponse } from '../model/display';
import { PassportCard } from './PassportCard';

type Item = { kind: 'heading'; id: string } | { kind: 'passport'; id: string; passport: PassportResponse };

/** The active car's passports, then those of cars no longer in the garage (still revocable). */
export function PassportsScreen() {
  const passports = usePassports();
  const vehicles = useVehicles();
  const active = useActiveCar();
  useRefetchOnFocus(passports.refetch);

  const all = passports.data ?? [];
  const owned = new Set(active.cars.map((car) => car.vin));
  const current = active.car ? all.filter((p) => p.vin === active.car.vin) : [];
  const former = all.filter((p) => !owned.has(p.vin));
  const items: Item[] = [
    ...current.map((passport): Item => ({ kind: 'passport', id: passport.id, passport })),
    ...(former.length > 0 ? [{ kind: 'heading', id: 'former' } as Item] : []),
    ...former.map((passport): Item => ({ kind: 'passport', id: passport.id, passport })),
  ];

  return (
    <Screen
      header={
        <View style={{ minHeight: 56, justifyContent: 'center', paddingHorizontal: tokens.space['space-4'] }}>
          <CarSwitcher fallbackTitle={en.tabs.passports} />
        </View>
      }
    >
      <AsyncList
        query={{
          isPending: passports.isPending || active.status === 'loading',
          isError: passports.isError || active.status === 'error',
          isRefetching: passports.isRefetching,
          refetch: () => {
            void passports.refetch();
            active.refetch();
          },
        }}
        data={passports.data ? items : undefined}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          item.kind === 'heading' ? (
            <Text variant="label" color="ink-muted" accessibilityRole="header">
              {en.passport.formerCars}
            </Text>
          ) : (
            <PassportCard passport={item.passport} vehicles={vehicles.data ?? []} />
          )
        }
        empty={<EmptyState icon="doc" title={en.passport.emptyTitle} body={en.passport.emptyBody} />}
      />
    </Screen>
  );
}
