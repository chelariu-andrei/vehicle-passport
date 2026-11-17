import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/shared/design';

import type { ChartPoint } from '../../model/chartData';

type Props = {
  series: ChartPoint[];
  /** The numbers in words, for screen readers: the chart itself is not the only carrier of meaning. */
  ariaSummary: string;
  onPointPress?: (index: number) => void;
  height?: number;
};

const PAD_X = 12;
const PAD_Y = 16;

/** A thin line with dots. No chart library: scaled to the data's own min and max. */
export function LineChart({ series, ariaSummary, onPointPress, height = 160 }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(320);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(120, e.nativeEvent.layout.width));

  const xs = series.map((p) => p.x);
  const ys = series.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (y0 === y1) [y0, y1] = [y0 - 1, y1 + 1];
  const px = (x: number) => (x1 === x0 ? width / 2 : PAD_X + ((x - x0) / (x1 - x0)) * (width - 2 * PAD_X));
  const py = (y: number) => height - PAD_Y - ((y - y0) / (y1 - y0)) * (height - 2 * PAD_Y);
  const line = series.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');

  return (
    <View accessible accessibilityLabel={ariaSummary} onLayout={onLayout} style={{ height }}>
      <Svg width={width} height={height}>
        <Line x1={PAD_X} y1={height - PAD_Y} x2={width - PAD_X} y2={height - PAD_Y} stroke={colors.line} strokeWidth={1} />
        {series.length > 1 ? <Polyline points={line} fill="none" stroke={colors.brand} strokeWidth={2} /> : null}
        {series.map((p, i) => (
          <Circle
            key={`${p.x}-${i}`}
            cx={px(p.x)}
            cy={py(p.y)}
            r={p.flagged ? 6 : 4}
            fill={p.flagged ? colors.warning : colors.brand}
            onPress={onPointPress ? () => onPointPress(i) : undefined}
          />
        ))}
        {series.length > 0 ? (
          <>
            <SvgText x={PAD_X} y={10} fontSize={10} fill={colors['ink-muted']}>{Number(y1.toFixed(1))}</SvgText>
            <SvgText x={PAD_X} y={height - 2} fontSize={10} fill={colors['ink-muted']}>{Number(y0.toFixed(1))}</SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}
