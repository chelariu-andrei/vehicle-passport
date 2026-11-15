import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { carSilhouette } from '../../../viewer/car-kit';
import { paintHex, type Look } from './look';

const WHEEL_STROKE = 1.6;

/** The flat side view of a look: what a list row shows, and what the stage shows until the 3D is ready. */
export function CarSilhouette({ look, width }: { look: Look; width: number }) {
  const { colors } = useTheme();
  const shape = carSilhouette(look.bodyType);
  return (
    <Svg
      testID="car-silhouette"
      accessibilityLabel={en.look.body[look.bodyType ?? 'SEDAN']}
      width={width}
      height={width * 0.4}
      viewBox={shape.viewBox}
    >
      <G>
        <Path d={shape.body} fill={paintHex(look)} />
        <Path d={shape.glass} fill={colors['surface-raised']} />
        {shape.wheels.map((wheel, index) => (
          <Circle
            key={index}
            cx={wheel.cx}
            cy={wheel.cy}
            r={wheel.r}
            fill={colors.bg}
            stroke={colors['ink-muted']}
            strokeWidth={WHEEL_STROKE}
          />
        ))}
      </G>
    </Svg>
  );
}
