import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';

/** One choice of a chip group: a radio for one-of-many, a checkbox for any-of-many. 48 points tall, never colour alone. */
export function Chip({
  label,
  selected,
  onPress,
  role,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  role: 'radio' | 'checkbox';
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'radio' ? { selected, disabled } : { checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
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
      <Text variant="label">{label}</Text>
    </Pressable>
  );
}

/** A labelled, wrapping row of chips. */
export function ChipGroup({
  label,
  role,
  error,
  children,
}: {
  label: string;
  role: 'radiogroup' | 'group';
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole={role === 'radiogroup' ? 'radiogroup' : undefined} accessibilityLabel={label}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>{children}</View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
