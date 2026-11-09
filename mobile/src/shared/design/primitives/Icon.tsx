import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '../theme';
import type { ColorName } from '../tokens.generated';

type Shape = { d: string } | { cx: number; cy: number; r: number } | { x: number; y: number; width: number; height: number; rx: number };

// Paths from the design system's icon bundle (24 x 24 grid, stroked).
const SHAPES: Record<string, Shape[]> = {
  car: [
    { d: 'M5 16l1.4-4.6A2 2 0 0 1 8.3 10h7.4a2 2 0 0 1 1.9 1.4L19 16' },
    { d: 'M3.5 16h17v3h-2.2a1.5 1.5 0 0 1-3 0H8.7a1.5 1.5 0 0 1-3 0H3.5z' },
    { d: 'M7 13h.01M17 13h.01' },
  ],
  wrench: [
    { d: 'M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.1-.5-.5-2.1z' },
  ],
  scan: [
    { d: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2' },
    { d: 'M8 12h8' },
  ],
  shield: [
    { d: 'M12 3l7 3v5.5c0 4.2-2.9 7.8-7 9.5-4.1-1.7-7-5.3-7-9.5V6z' },
    { d: 'M9 12l2.2 2.2L15.5 10' },
  ],
  doc: [
    { d: 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z' },
    { d: 'M14 3v4h4M9 12h6M9 16h4' },
  ],
  user: [{ cx: 12, cy: 8.5, r: 3.5 }, { d: 'M5 20a7 7 0 0 1 14 0' }],
  pass: [
    { x: 4.5, y: 3, width: 15, height: 18, rx: 3 },
    { cx: 12, cy: 10, r: 2.6 },
    { d: 'M8.5 16.5h7' },
  ],
  qr: [
    { x: 4, y: 4, width: 6, height: 6, rx: 1 },
    { x: 14, y: 4, width: 6, height: 6, rx: 1 },
    { x: 4, y: 14, width: 6, height: 6, rx: 1 },
    { d: 'M14 14h2.5v2.5H14zM18 18h2M18 14v.01M14 20v-1.5' },
  ],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  chevron: [{ d: 'M9 6l6 6-6 6' }],
  clock: [{ cx: 12, cy: 12, r: 8.5 }, { d: 'M12 7.5V12l3 2' }],
  alert: [{ d: 'M12 4l9 15.5H3z' }, { d: 'M12 10v4.5M12 17.2v.01' }],
  share: [{ d: 'M12 15V4M8 8l4-4 4 4' }, { d: 'M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5' }],
  rotate: [{ d: 'M20 12a8 8 0 1 1-2.6-5.9' }, { d: 'M20 4v4.5h-4.5' }],
};

export type IconName = keyof typeof SHAPES;
export const iconNames = Object.keys(SHAPES) as IconName[];

type Props = { name: IconName; size?: number; color?: ColorName };

/** Decorative: hidden from screen readers. The surrounding control carries the label. */
export function Icon({ name, size = 24, color = 'ink' }: Props) {
  const { colors } = useTheme();
  const stroke = colors[color];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {SHAPES[name].map((shape, index) => {
        if ('d' in shape) return <Path key={index} d={shape.d} />;
        if ('r' in shape) return <Circle key={index} {...shape} />;
        return <Rect key={index} {...shape} />;
      })}
    </Svg>
  );
}
