import { Pressable, View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

/** The server's consumption warning in plain words with both numbers. It has no dismiss: it goes when the next full tank is normal. */
export function AlertCard({ deltaPct, latest, baseline, onPress }: { deltaPct: number; latest: string; baseline: string; onPress(): void }) {
  const { colors } = useTheme();
  const title = en.fuelLog.stats.alertTitle(`${Math.round(deltaPct)} %`);
  const body = en.fuelLog.stats.alertBody(latest, baseline);
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: tokens.space['space-3'],
        padding: tokens.space['space-4'],
        borderRadius: tokens.radius['radius-lg'],
        borderWidth: 1,
        borderColor: colors.warning,
        backgroundColor: colors['surface-raised'],
      }}
    >
      <Icon name="alert" size={24} color="warning" />
      <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
        <Text variant="title">{title}</Text>
        <Text>{body}</Text>
      </View>
    </Pressable>
  );
}
