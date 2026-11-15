import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text, tokens, useTheme } from '@/shared/design';

type Props = { label: string; selected: boolean; onPress: () => void; children?: ReactNode };

/** One option of a radio group: a 48 point tile whose selected state is a border and a check, never colour alone. */
export function Choice({ label, selected, onPress, children }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: tokens.space['space-3'],
        paddingVertical: tokens.space['space-2'],
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-2'],
        borderRadius: tokens.radius['radius-md'],
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.brand : colors['line-strong'],
        backgroundColor: colors.surface,
      }}
    >
      {children}
      <View style={{ flexShrink: 1 }}>
        <Text variant="label">{selected ? `✓ ${label}` : label}</Text>
      </View>
    </Pressable>
  );
}

export function ChoiceRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>{children}</View>;
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="label" color="ink-muted">
        {title}
      </Text>
      {children}
    </View>
  );
}
