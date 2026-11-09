import { View, type DimensionValue } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';

type Props = { width?: DimensionValue; height?: number };

/** A still placeholder block, hidden from screen readers; the parent announces "Loading". It does not animate, so Reduce Motion needs no special case. */
export function Skeleton({ width = '100%', height = 20 }: Props) {
  const { colors } = useTheme();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width, height, borderRadius: tokens.radius['radius-sm'], backgroundColor: colors['surface-raised'] }}
    />
  );
}
