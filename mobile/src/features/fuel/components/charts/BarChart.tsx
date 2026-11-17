import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/shared/design';

import type { Bar } from '../../model/chartData';

type Props = { bars: Bar[]; ariaSummary: string; height?: number };

const PAD_BOTTOM = 20;
const GAP = 8;

/** One bar per month. The unfinished (partial) month is drawn lighter. */
export function BarChart({ bars, ariaSummary, height = 160 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(120, e.nativeEvent.layout.width));

  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = bars.length > 0 ? width / bars.length : width;
  const barWidth = Math.max(4, slot - GAP);
  const plotHeight = height - PAD_BOTTOM - 14;

  return (
    <View accessible accessibilityLabel={ariaSummary} onLayout={onLayout} style={{ height }}>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height - PAD_BOTTOM} x2={width} y2={height - PAD_BOTTOM} stroke={colors.line} strokeWidth={1} />
        {bars.map((b, i) => {
          const h = (b.value / max) * plotHeight;
          const x = i * slot + GAP / 2;
          return (
            <G key={`${b.label}-${i}`}>
              <Rect x={x} y={height - PAD_BOTTOM - h} width={barWidth} height={h} rx={3} fill={colors.brand} opacity={b.partial ? 0.45 : 1} />
              <SvgText x={x + barWidth / 2} y={height - 5} fontSize={10} fill={colors['ink-muted']} textAnchor="middle">{b.label}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
