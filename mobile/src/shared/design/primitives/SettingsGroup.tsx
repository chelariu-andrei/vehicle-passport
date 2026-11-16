import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { Text } from './Text';

type Props = { title?: string; children: ReactNode; testID?: string };

/** A titled card of settings rows, divided by hairlines. */
export function SettingsGroup({ title, children, testID }: Props) {
  const { colors } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View testID={testID} style={{ gap: tokens.space['space-2'] }}>
      {title ? (
        <Text variant="label" color="ink-muted" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: tokens.radius['radius-lg'],
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <View key={index} style={index > 0 ? { borderTopWidth: 1, borderTopColor: colors.line } : undefined}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}
