import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../theme';

const GRAIN = require('../../../../assets/grain.png');

/** The app background: true black lit from above, falling away at the bottom, with fine grain in the dark theme. */
export function Ground({ children }: { children: ReactNode }) {
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id="vp-ground-light" gradientUnits="userSpaceOnUse" cx="50%" cy="0%" rx="65%" ry="44%">
            <Stop offset="0" stopColor={colors['bg-lift']} stopOpacity={1} />
            <Stop offset="1" stopColor={colors['bg-lift']} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="vp-ground-floor" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.58" stopColor={colors['ground-shade']} stopOpacity={0} />
            <Stop offset="1" stopColor={colors['ground-shade']} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vp-ground-light)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vp-ground-floor)" />
      </Svg>
      {scheme === 'dark' ? (
        <Image
          testID="ground-grain"
          source={GRAIN}
          resizeMode="repeat"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: 0.055 }]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
