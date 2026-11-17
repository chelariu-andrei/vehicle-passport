import { View } from 'react-native';

import { Card, Text, tokens } from '@/shared/design';

/** One number of the summary: the value, what it is, and why it is missing when it is (`–` with a caption, never `0`). */
export function StatTile({ value, label, caption }: { value: string; label: string; caption?: string }) {
  return (
    <View testID={`stat-${label}`} accessible accessibilityLabel={caption ? `${label}: ${value}, ${caption}` : `${label}: ${value}`} style={{ flexBasis: '45%', flexGrow: 1 }}>
      <Card style={{ gap: tokens.space['space-1'], minHeight: 96 }}>
        <Text variant="title-lg">{value}</Text>
        <Text variant="caption" color="ink-muted">
          {label}
        </Text>
        {caption ? (
          <Text variant="caption" color="ink-muted">
            {caption}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}
