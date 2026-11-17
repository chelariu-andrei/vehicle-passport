import { View } from 'react-native';

import { Text, tokens } from '@/shared/design';

/** A label over its value: one row of the detail screen. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label" color="ink-muted">
        {label}
      </Text>
      <Text variant="body-lg">{value}</Text>
    </View>
  );
}
