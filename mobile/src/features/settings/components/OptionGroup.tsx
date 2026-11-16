import { Pressable, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';

export type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  title: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** One choice out of a few, as a titled card of radio rows. */
export function OptionGroup<T extends string>({ title, options, value, onChange }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="label" color="ink-muted" accessibilityRole="header">
        {title}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: tokens.radius['radius-lg'],
          overflow: 'hidden',
        }}
      >
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={{
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                gap: tokens.space['space-3'],
                paddingHorizontal: tokens.space['space-4'],
                paddingVertical: tokens.space['space-2'],
                borderTopWidth: index > 0 ? 1 : 0,
                borderTopColor: colors.line,
              }}
            >
              <Text style={{ flex: 1 }}>{option.label}</Text>
              {selected ? <Icon name="check" size={20} color="brand" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
