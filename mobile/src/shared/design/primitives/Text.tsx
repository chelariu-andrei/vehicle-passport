import { Text as RNText, type TextProps } from 'react-native';

import { fontFamilyFor } from '../fonts';
import { useTheme } from '../theme';
import { tokens, type ColorName, type TypeVariant } from '../tokens.generated';

type Props = TextProps & { variant?: TypeVariant; color?: ColorName };

export function Text({ variant = 'body', color = 'ink', style, ...rest }: Props) {
  const { colors } = useTheme();
  const { fontSize, lineHeight, letterSpacing } = tokens.type[variant];
  return (
    <RNText
      {...rest}
      style={[{ color: colors[color], fontFamily: fontFamilyFor(variant), fontSize, lineHeight, letterSpacing }, style]}
    />
  );
}
