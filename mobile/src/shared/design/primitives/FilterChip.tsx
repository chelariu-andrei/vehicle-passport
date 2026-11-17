import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Text } from './Text';

const CHIP_MIN_HEIGHT = 36;
const CHIP_HIT_HEIGHT = 44;

type Props = {
  label: string;
  active: boolean;
  /** A short count or marker shown after the label. */
  badge?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

/** A pill that toggles or opens a filter. Looks 36 tall; the touch target is 44. */
export function FilterChip({ label, active, badge, onPress, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (badge ? `${label}, ${badge}` : label)}
      accessibilityState={{ selected: active }}
      hitSlop={{ top: (CHIP_HIT_HEIGHT - CHIP_MIN_HEIGHT) / 2, bottom: (CHIP_HIT_HEIGHT - CHIP_MIN_HEIGHT) / 2 }}
      onPress={onPress}
      style={{
        minHeight: CHIP_MIN_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-2'],
        paddingHorizontal: tokens.space['space-3'],
        borderRadius: tokens.radius['radius-pill'],
        borderWidth: 1,
        borderColor: active ? colors.brand : colors['line-strong'],
        backgroundColor: active ? colors['brand-deep'] : colors.surface,
      }}
    >
      <Text variant="label" color={active ? 'on-brand-deep' : 'ink'}>
        {label}
      </Text>
      {badge ? (
        <View
          style={{
            minWidth: tokens.space['space-5'],
            paddingHorizontal: tokens.space['space-1'],
            alignItems: 'center',
            borderRadius: tokens.radius['radius-pill'],
            backgroundColor: active ? colors.brand : colors['surface-raised'],
          }}
        >
          <Text variant="label" color={active ? 'on-brand' : 'ink'}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
