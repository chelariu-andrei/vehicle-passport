import { View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import type { IconName } from '@/shared/design';
import { en } from '@/shared/i18n/en';

const ROWS: { icon: IconName; copy: readonly [string, string] }[] = [
  { icon: 'window', copy: en.journey.whereWindscreen },
  { icon: 'car', copy: en.journey.wherePillar },
  { icon: 'doc', copy: en.journey.whereCertificate },
];

/** Three places a VIN is printed, each with a small glyph. */
export function WhereToFindVin() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-3'] }}>
      <Text variant="title" accessibilityRole="header">
        {en.journey.whereTitle}
      </Text>
      {ROWS.map(({ icon, copy }) => (
        <View key={copy[0]} accessible style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'] }}>
          <View
            style={{
              width: 48,
              height: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: tokens.radius['radius-md'],
              backgroundColor: colors['surface-raised'],
            }}
          >
            <Icon name={icon} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{copy[0]}</Text>
            <Text variant="caption" color="ink-muted">
              {copy[1]}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
