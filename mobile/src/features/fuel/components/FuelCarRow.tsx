import { useRouter } from 'expo-router';

import { SettingsGroup, SettingsRow } from '@/shared/design';
import { useLocale } from '@/shared/i18n';
import { en } from '@/shared/i18n/en';

import { useFuelStats } from '../api/useFuelStats';
import { formatConsumption } from '../model/fuelDisplay';

/** The car screen's way into Fuel. Its subtitle is the average consumption, only once there is one: nothing while loading or failing. */
export function FuelCarRow({ vin }: { vin: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  // The fuel screen opens on 6 months, so this read warms its cache.
  const stats = useFuelStats(vin, '6m');
  const known = stats.data?.byFuelType.find((t) => t.avgConsumption != null);
  const subtitle = known ? formatConsumption(known.avgConsumption ?? null, known.fuelType, locale) : undefined;
  return (
    <SettingsGroup>
      <SettingsRow icon="fuel" label={en.fuelLog.carRow} value={subtitle} onPress={() => router.push(`/vehicles/${vin}/fuel` as never)} />
    </SettingsGroup>
  );
}
