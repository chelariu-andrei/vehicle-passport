import { useState } from 'react';
import { PanResponder, View } from 'react-native';

import { Text, tokens, useTheme } from '@/shared/design';

type Props = { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** A horizontal slider: drag, or use the accessibility increment and decrement actions. */
export function Track({ label, value, min, max, step, onChange }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(1);
  // Handlers only read the position of the touch, so a fresh responder per render loses nothing mid-drag.
  const move = (x: number) => onChange(min + clamp(x / width, 0, 1) * (max - min));
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => move(event.nativeEvent.locationX),
    onPanResponderMove: (event) => move(event.nativeEvent.locationX),
  });
  const fraction = clamp((value - min) / (max - min), 0, 1);
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label">{label}</Text>
      <View
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: Math.round(value * 100) / 100 }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') onChange(clamp(value + step, min, max));
          if (event.nativeEvent.actionName === 'decrement') onChange(clamp(value - step, min, max));
        }}
        onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
        style={{ height: 48, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors['line-strong'] }} />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${fraction * 100}%`,
            marginLeft: -12,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.brand,
            borderWidth: 2,
            borderColor: colors.ink,
          }}
        />
      </View>
    </View>
  );
}
