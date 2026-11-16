import { ActivityIndicator, Pressable } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { MIN_TOUCH } from './Button';
import { Text } from './Text';

type Props = {
  provider: 'apple' | 'google';
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/** A "Continue with ..." button: Apple solid, Google outlined, as each provider's guidelines ask. */
export function SocialButton({ provider, title, onPress, disabled = false, loading = false }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const solid = provider === 'apple';
  const text = solid ? 'bg' : 'ink';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (!inactive) onPress();
      }}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        paddingHorizontal: tokens.space['space-5'],
        paddingVertical: tokens.space['space-3'],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.space['space-2'],
        borderRadius: tokens.radius['radius-pill'],
        borderWidth: 1,
        borderColor: solid ? colors.ink : colors['line-strong'],
        backgroundColor: solid ? colors.ink : colors['surface-raised'],
        opacity: inactive && !loading ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={colors[text]} /> : null}
      <Text variant="label" color={text}>
        {title}
      </Text>
    </Pressable>
  );
}
