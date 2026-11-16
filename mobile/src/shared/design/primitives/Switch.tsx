import { Switch as NativeSwitch, View } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Text } from './Text';

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

/** A labelled on/off setting. The label is also what a screen reader announces for the switch. */
export function Switch({ label, value, onValueChange, disabled = false }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <NativeSwitch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors['line-strong'], true: colors.brand }}
      />
    </View>
  );
}
