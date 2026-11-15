import { useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { en } from '@/shared/i18n/en';

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
  /** Set in the VIN face, for identifiers. */
  mono?: boolean;
};

/** iOS number pads have no return key, so they get a Done bar that closes the keyboard. */
const NUMERIC = ['number-pad', 'decimal-pad', 'phone-pad', 'numeric'];

export function Field({ label, error, helper, mono = false, ...input }: Props) {
  const { colors } = useTheme();
  const accessoryId = `field-done-${useId()}`;
  const needsDone = Platform.OS === 'ios' && input.keyboardType !== undefined && NUMERIC.includes(input.keyboardType);
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label">{label}</Text>
      {needsDone ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={{ alignItems: 'flex-end', backgroundColor: colors['surface-raised'], borderTopWidth: 1, borderTopColor: colors['line-strong'] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={en.common.keyboardDone}
              onPress={Keyboard.dismiss}
              style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: tokens.space['space-4'] }}
            >
              <Text variant="label" color="brand">
                {en.common.keyboardDone}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
      <TextInput
        returnKeyType="done"
        submitBehavior={input.multiline ? 'blurAndSubmit' : undefined}
        {...input}
        inputAccessoryViewID={needsDone ? accessoryId : undefined}
        accessibilityLabel={label}
        placeholderTextColor={colors['ink-muted']}
        style={{
          minHeight: MIN_TOUCH,
          paddingHorizontal: tokens.space['space-4'],
          backgroundColor: colors['surface-raised'],
          color: colors.ink,
          fontFamily: fontFamilyFor(mono ? 'vin' : 'body-lg'),
          fontSize: tokens.type[mono ? 'vin' : 'body-lg'].fontSize,
          letterSpacing: mono ? tokens.type.vin.letterSpacing : undefined,
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
