import { ActivityIndicator, Pressable } from 'react-native';

import { useTheme } from '../theme';
import { tokens, type ColorName } from '../tokens.generated';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  kind?: 'primary' | 'secondary' | 'danger' | 'quiet';
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  /** Only for `quiet`: draws the text in the danger colour. */
  danger?: boolean;
};

export const MIN_TOUCH = 48;

export function Button({ kind = 'primary', title, onPress, disabled = false, loading = false, icon, danger = false }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const text: ColorName =
    kind === 'primary' ? 'on-brand' : kind === 'danger' || (kind === 'quiet' && danger) ? 'danger' : kind === 'quiet' ? 'ink-muted' : 'ink';
  const border = kind === 'danger' ? colors.danger : colors['line-strong'];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (!inactive) onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          minWidth: MIN_TOUCH,
          paddingHorizontal: tokens.space['space-5'],
          paddingVertical: tokens.space['space-3'],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: tokens.space['space-2'],
          opacity: inactive && !loading ? 0.5 : pressed ? 0.85 : 1,
        },
        kind === 'primary'
          ? { backgroundColor: colors.brand, borderRadius: tokens.radius['radius-pill'] }
          : kind === 'quiet'
            ? { borderRadius: tokens.radius['radius-md'] }
            : { borderWidth: 1, borderColor: border, borderRadius: tokens.radius['radius-md'] },
      ]}
    >
      {loading ? <ActivityIndicator color={colors[text]} /> : icon ? <Icon name={icon} size={20} color={text} /> : null}
      <Text variant="label" color={text}>
        {title}
      </Text>
    </Pressable>
  );
}
