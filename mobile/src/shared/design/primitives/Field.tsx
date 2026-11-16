import { useId, useState } from "react";
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useStrings } from "@/shared/i18n";
import { en } from "@/shared/i18n/en";

import { useTheme } from "../theme";
import { tokens } from "../tokens.generated";
import { fontFamilyFor } from "../fonts";
import { Icon } from "./Icon";
import { MIN_TOUCH } from "./Button";
import { Text } from "./Text";

type Props = Omit<TextInputProps, "style" | "accessibilityLabel"> & {
  label: string;
  error?: string;
  helper?: string;
  /** Set in the VIN face, for identifiers. */
  mono?: boolean;
};

/** iOS number pads have no return key, so they get a Done bar that closes the keyboard. */
const NUMERIC = ["number-pad", "decimal-pad", "phone-pad", "numeric"];

export function Field({ label, error, helper, mono = false, ...input }: Props) {
  const { colors } = useTheme();
  const s = useStrings();
  const [revealed, setRevealed] = useState(false);
  const secret = input.secureTextEntry === true;
  const accessoryId = `field-done-${useId()}`;
  const needsDone =
    Platform.OS === "ios" &&
    input.keyboardType !== undefined &&
    NUMERIC.includes(input.keyboardType);
  return (
    <View style={{ gap: tokens.space["space-1"] }}>
      <Text variant="label">{label}</Text>
      {needsDone ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View
            style={{
              alignItems: "flex-end",
              backgroundColor: colors["surface-raised"],
              borderTopWidth: 1,
              borderTopColor: colors["line-strong"],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={en.common.keyboardDone}
              onPress={Keyboard.dismiss}
              style={{
                minHeight: MIN_TOUCH,
                justifyContent: "center",
                paddingHorizontal: tokens.space["space-4"],
              }}
            >
              <Text variant="label" color="brand">
                {en.common.keyboardDone}
              </Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
      <View>
        <TextInput
          {...input}
          secureTextEntry={secret && !revealed}
          returnKeyType="done"
          submitBehavior={input.multiline ? "blurAndSubmit" : undefined}
          inputAccessoryViewID={needsDone ? accessoryId : undefined}
          accessibilityLabel={label}
          placeholderTextColor={colors["ink-muted"]}
          style={{
            minHeight: MIN_TOUCH,
            paddingRight: secret ? MIN_TOUCH : tokens.space["space-4"],
            paddingLeft: tokens.space["space-4"],
            backgroundColor: colors["surface-raised"],
            color: colors.ink,
            fontFamily: fontFamilyFor(mono ? "vin" : "body-lg"),
            fontSize: tokens.type[mono ? "vin" : "body-lg"].fontSize,
            letterSpacing: mono ? tokens.type.vin.letterSpacing : undefined,
            borderRadius: tokens.radius["radius-md"],
            borderWidth: 1,
            borderColor: error ? colors.danger : colors["line-strong"],
          }}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              revealed ? s.auth.hidePassword : s.auth.showPassword
            }
            onPress={() => setRevealed((shown) => !shown)}
            hitSlop={4}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: MIN_TOUCH,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name={revealed ? "eye-off" : "eye"}
              size={22}
              color="ink-muted"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.space["space-1"],
          }}
        >
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
