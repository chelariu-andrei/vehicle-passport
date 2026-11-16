import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { MIN_TOUCH } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Current value, shown muted before the chevron. */
  value?: string;
  /** Destructive rows are set in the danger colour. */
  danger?: boolean;
  /** Hides the chevron for actions that do not open a screen. */
  chevron?: boolean;
  disabled?: boolean;
};

/** One tappable line of a settings list. */
export function SettingsRow({ label, onPress, icon, value, danger = false, chevron = true, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-3'],
        paddingHorizontal: tokens.space['space-4'],
        paddingVertical: tokens.space['space-2'],
        backgroundColor: pressed ? colors['surface-raised'] : 'transparent',
        opacity: disabled ? 0.5 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={22} color={danger ? 'danger' : 'ink-muted'} /> : null}
      <Text style={{ flex: 1 }} color={danger ? 'danger' : 'ink'}>
        {label}
      </Text>
      {value ? (
        <View style={{ flexShrink: 1 }}>
          <Text variant="caption" color="ink-muted" numberOfLines={1}>
            {value}
          </Text>
        </View>
      ) : null}
      {chevron ? <Icon name="chevron" size={18} color="ink-muted" /> : null}
    </Pressable>
  );
}
