import { View } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Text } from './Text';

type Props = { count: number; tone: 'warn' | 'bad'; testID?: string };

/** The small count pill on an icon. Hidden at 0; shows `9+` above nine. The text colour is the theme's on-colour, which keeps contrast on both warning and danger. */
export function CountBadge({ count, tone, testID }: Props) {
  const { colors } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID={testID}
      style={{
        minWidth: 18,
        minHeight: 18,
        paddingHorizontal: tokens.space['space-1'],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tokens.radius['radius-pill'],
        backgroundColor: tone === 'bad' ? colors.danger : colors.warning,
      }}
    >
      <Text variant="caption" color="on-brand">
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}
