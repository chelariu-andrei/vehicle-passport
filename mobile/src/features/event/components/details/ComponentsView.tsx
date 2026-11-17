import { View } from 'react-native';

import { Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { COMPONENT_CONFIG, type Component } from '../../model/components';

/** The parts of the car the entry touched, as read-only chips. */
export function ComponentsView({ components }: { components: readonly Component[] }) {
  const { colors } = useTheme();
  if (components.length === 0) return null;
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label" color="ink-muted">
        {en.event.check.components}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {components.map((component) => (
          <View
            key={component}
            style={{
              minHeight: 32,
              paddingHorizontal: tokens.space['space-3'],
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.space['space-1'],
              borderRadius: tokens.radius['radius-pill'],
              borderWidth: 1,
              borderColor: colors['line-strong'],
            }}
          >
            <Icon name={COMPONENT_CONFIG[component].icon} size={16} color="ink-muted" />
            <Text variant="label">{COMPONENT_CONFIG[component].label()}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
