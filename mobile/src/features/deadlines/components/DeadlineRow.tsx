import { Pressable, View } from 'react-native';

import { formatDate } from '@/features/event';
import { Icon, StatusPill, Text, tokens, useTheme, type IconName, type StatusTone } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { DeadlineItem } from '../api/useDeadlines';
import { DOCUMENT_CONFIG } from '../model/documentRegistry';

const PILL: Record<DeadlineItem['status'], { tone: StatusTone; icon?: IconName; dashed?: boolean }> = {
  VALID: { tone: 'ok', icon: 'check' },
  EXPIRING: { tone: 'warn', icon: 'clock' },
  EXPIRED: { tone: 'bad', icon: 'alert' },
  UNKNOWN: { tone: 'muted', icon: 'clock', dashed: true },
  NOT_RECORDED: { tone: 'muted', dashed: true },
};

/** The line under the document name. */
export function detailLine(item: DeadlineItem): string {
  const s = en.deadlines;
  switch (item.status) {
    case 'VALID':
    case 'EXPIRING':
      return item.validUntil && item.daysLeft !== null ? s.until(formatDate(item.validUntil), item.daysLeft) : '';
    case 'EXPIRED':
      return item.daysLeft !== null ? s.expiredAgo(Math.abs(item.daysLeft)) : s.status.EXPIRED;
    case 'UNKNOWN':
      return s.addDate;
    case 'NOT_RECORDED':
      return DOCUMENT_CONFIG[item.kind].optional ? s.optionalAdd : s.add;
  }
}

export function DeadlineRow({ item, onPress }: { item: DeadlineItem; onPress: () => void }) {
  const { colors } = useTheme();
  const config = DOCUMENT_CONFIG[item.kind];
  const look = PILL[item.status];
  const word = en.deadlines.status[item.status];
  const detail = detailLine(item);
  return (
    <Pressable
      testID={`deadline-row-${item.kind}`}
      accessibilityRole="button"
      accessibilityLabel={`${config.label()}, ${word}, ${detail}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-3'],
        paddingHorizontal: tokens.space['space-4'],
        paddingVertical: tokens.space['space-3'],
        backgroundColor: pressed ? colors['surface-raised'] : 'transparent',
      })}
    >
      <Icon name={config.icon} />
      <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
        <Text>{config.label()}</Text>
        <Text variant="caption" color="ink-muted">
          {detail}
        </Text>
      </View>
      <StatusPill tone={look.tone} icon={look.icon} dashed={look.dashed} label={word} />
    </Pressable>
  );
}
