import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { en } from '@/shared/i18n/en';

import { tokens } from '../tokens.generated';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = { onBack?: () => void; title?: string; right?: ReactNode };

const TARGET = 44;

/** The top bar. The back chevron appears only when there is somewhere to go back to. */
export function AppBar({ onBack, title, right }: Props) {
  return (
    <View
      style={{
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: tokens.space['space-2'],
        gap: tokens.space['space-2'],
      }}
    >
      <View style={{ width: TARGET, height: TARGET }}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={en.common.back}
            onPress={onBack}
            hitSlop={4}
            style={{ width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="back" />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <Text variant="title" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        ) : null}
      </View>
      <View style={{ minWidth: TARGET, minHeight: TARGET, alignItems: 'center', justifyContent: 'center' }}>{right}</View>
    </View>
  );
}
