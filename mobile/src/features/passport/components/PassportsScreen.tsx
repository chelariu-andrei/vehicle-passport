import { useVehicles } from '@/features/vehicle';
import { useRefetchOnFocus } from '@/shared/api';
import { AsyncList, EmptyState, Screen, Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { usePassports } from '../api/usePassports';
import { PassportCard } from './PassportCard';

export function PassportsScreen() {
  const passports = usePassports();
  const vehicles = useVehicles();
  useRefetchOnFocus(passports.refetch);

  return (
    <Screen>
      <Text variant="display-xl" accessibilityRole="header">
        {en.tabs.passports}
      </Text>
      <AsyncList
        query={passports}
        data={passports.data}
        keyExtractor={(passport) => passport.id}
        renderItem={({ item }) => <PassportCard passport={item} vehicles={vehicles.data ?? []} />}
        empty={<EmptyState icon="doc" title={en.passport.emptyTitle} body={en.passport.emptyBody} />}
      />
    </Screen>
  );
}
