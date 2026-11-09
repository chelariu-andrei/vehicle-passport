import { Pressable, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { FUEL_TYPES } from '../model/vehicleForm';
import type { FuelType } from '../model/vehicleForm';

export function FuelPicker({ value, onChange, error }: { value: FuelType | null; onChange(fuel: FuelType): void; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={en.vehicleForm.fuel}>
      <Text variant="label">{en.vehicleForm.fuel}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {FUEL_TYPES.map((fuel) => {
          const selected = fuel === value;
          return (
            <Pressable
              key={fuel}
              accessibilityRole="radio"
              accessibilityLabel={en.fuel[fuel]}
              accessibilityState={{ selected }}
              onPress={() => onChange(fuel)}
              style={{
                minHeight: 48,
                minWidth: 48,
                paddingHorizontal: tokens.space['space-4'],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space['space-1'],
                borderRadius: tokens.radius['radius-pill'],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
                backgroundColor: selected ? colors['surface-raised'] : 'transparent',
              }}
            >
              {selected ? <Icon name="check" size={16} color="brand" /> : null}
              <Text variant="label">{en.fuel[fuel]}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
