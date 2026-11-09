import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { fontFamilyFor } from '../fonts';
import { Icon } from './Icon';
import { MIN_TOUCH } from './Button';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  label: string;
  error?: string;
  helper?: string;
};

export function Field({ label, error, helper, ...input }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label">{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={colors['ink-muted']}
        style={{
          minHeight: MIN_TOUCH,
          paddingHorizontal: tokens.space['space-4'],
          backgroundColor: colors['surface-raised'],
          color: colors.ink,
          fontFamily: fontFamilyFor('body-lg'),
          fontSize: tokens.type['body-lg'].fontSize,
          borderRadius: tokens.radius['radius-md'],
          borderWidth: 1,
          borderColor: error ? colors.danger : colors['line-strong'],
        }}
      />
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
          <Icon name="alert" size={16} color="danger" />
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="ink-muted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
