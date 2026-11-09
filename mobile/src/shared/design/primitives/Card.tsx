import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';

type Props = { children: ReactNode; style?: StyleProp<ViewStyle> };

export function Card({ children, style }: Props) {
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: tokens.radius['radius-lg'],
          padding: tokens.space['space-4'],
          boxShadow: tokens.shadow[scheme]['shadow-card'],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
