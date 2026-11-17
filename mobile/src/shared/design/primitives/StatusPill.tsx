import { View } from 'react-native';

import { useTheme } from '../theme';
import { tokens, type ColorName } from '../tokens.generated';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type StatusTone = 'ok' | 'warn' | 'bad' | 'muted';

const COLOR: Record<StatusTone, ColorName> = {
  ok: 'brand',
  warn: 'warning',
  bad: 'danger',
  muted: 'evidence-estimated',
};

type Props = { tone: StatusTone; label: string; icon?: IconName; dashed?: boolean; testID?: string };

/** A status as shape, word and colour together (colour is never the only cue); same look rules as `EvidenceBadge`. */
export function StatusPill({ tone, label, icon, dashed = false, testID }: Props) {
  const { colors } = useTheme();
  const color = COLOR[tone];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-1'],
        paddingHorizontal: tokens.space['space-2'],
        paddingVertical: tokens.space['space-1'],
        borderRadius: tokens.radius['radius-sm'],
        borderWidth: 1.5,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: colors[color],
      }}
    >
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text variant="caption" color={color}>
        {label}
      </Text>
    </View>
  );
}
