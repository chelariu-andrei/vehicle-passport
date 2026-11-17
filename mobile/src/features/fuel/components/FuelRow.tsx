import { Pressable, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { FuelEntry } from '../api/useFuelEntries';
import { formatConsumption, formatMoney, formatQuantity, unitOf } from '../model/fuelDisplay';

/** One fill-up of the history: date, fuel, quantity and total; then station, grade and consumption when there are any. */
export function FuelRow({ entry, locale, onPress }: { entry: FuelEntry; locale: string; onPress(): void }) {
  const { colors } = useTheme();
  const top = [entry.date, en.fuelLog.type[entry.fuelType], formatQuantity(entry.quantity, unitOf(entry.fuelType), locale), formatMoney(entry.total, entry.currency, locale)];
  const consumption = entry.consumption ?? null;
  const details = [
    entry.station ?? null,
    entry.grade ? en.fuelLog.grade[entry.grade] : null,
    entry.chargeType ? en.fuelLog.charge[entry.chargeType] : null,
    consumption === null ? null : formatConsumption(consumption, entry.fuelType, locale),
  ].filter((part): part is string => part !== null && part !== '');
  return (
    <Pressable
      testID={`fuel-row-${entry.id}`}
      accessibilityRole="button"
      accessibilityLabel={[...top, ...details].join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-3'],
        paddingVertical: tokens.space['space-2'],
        backgroundColor: pressed ? colors['surface-raised'] : 'transparent',
      })}
    >
      <Icon name={entry.fuelType === 'ELECTRIC' ? 'bolt' : 'fuel'} size={22} color="ink-muted" />
      <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: tokens.space['space-2'] }}>
          <Text>{`${top[0]}  ${top[2]}`}</Text>
          <Text variant="label">{top[3]}</Text>
        </View>
        {details.length > 0 ? (
          <Text variant="caption" color="ink-muted">
            {details.join(' · ')}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron" size={18} color="ink-muted" />
    </Pressable>
  );
}
