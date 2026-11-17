import type { UseQueryResult } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';

import { Card, Icon, Skeleton, Text, tokens, useTheme } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import type { TimelineSummary } from '../api/useTimelineSummary';
import { EVENT_TYPE_CONFIG, formatMoney, groupThousands } from '../model/eventTypes';

const TOP_TYPES = 4;
const SWATCH = 8;

/** A small caption over its value. */
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
      <Text variant="caption" color="ink-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

/** The four most frequent types, each with a swatch in its rail colour, then "+n" for the rest. */
function TypeCounts({ counts }: { counts: TimelineSummary['countsByType'] }) {
  const { colors } = useTheme();
  const t = useStrings().timeline;
  // The server lists types in registry order; the card leads with the most frequent, ties keep that order.
  const sorted = [...counts].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, TOP_TYPES);
  const more = sorted.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: tokens.space['space-3'], rowGap: tokens.space['space-1'] }}>
      {shown.map(({ type, count }) => (
        <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
          <View style={{ width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, backgroundColor: colors[EVENT_TYPE_CONFIG[type].tint] }} />
          <Text variant="caption">{`${EVENT_TYPE_CONFIG[type].label()} ${count}`}</Text>
        </View>
      ))}
      {more > 0 ? (
        <Text variant="caption" color="ink-muted">
          {t.moreTypes(more)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Aggregates of the filtered timeline: cost per currency, kilometres driven and event counts. It loads on its own: a skeleton first,
 * and when it fails a small retry, while the list below stays usable.
 */
export function SummaryCard({ summary }: { summary: UseQueryResult<TimelineSummary> }) {
  const { common, timeline: t } = useStrings();
  const { data } = summary;

  let body: React.ReactNode;
  if (data) {
    const cost = data.costByCurrency.map((c) => formatMoney(c.amount, c.currency)).join(' · ');
    body = (
      <View style={{ gap: tokens.space['space-3'], opacity: summary.isPlaceholderData ? 0.6 : 1 }}>
        <Stat label={t.cost}>
          <Text variant="title-lg">{cost === '' ? t.noCost : cost}</Text>
        </Stat>
        <View style={{ flexDirection: 'row', gap: tokens.space['space-4'] }}>
          <Stat label={t.kmDriven}>
            {data.distance.km === null ? (
              <>
                <Text variant="title">{t.noDistance}</Text>
                <Text variant="caption" color="ink-muted">
                  {t.noDistanceHint}
                </Text>
              </>
            ) : (
              <Text variant="title">{t.km(groupThousands(data.distance.km))}</Text>
            )}
          </Stat>
          <Stat label={t.events}>
            <Text variant="title">{t.eventCount(data.eventCount)}</Text>
          </Stat>
        </View>
        <TypeCounts counts={data.countsByType} />
      </View>
    );
  } else if (summary.isError) {
    body = (
      <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
        <Icon name="alert" size={16} color="danger" />
        <Text color="ink-muted" style={{ flex: 1 }}>
          {t.summaryFailed}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={common.retry}
          onPress={() => void summary.refetch()}
          hitSlop={8}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}
        >
          <Icon name="rotate" size={16} color="brand" />
          <Text variant="label" color="brand">
            {common.retry}
          </Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <View accessible accessibilityLabel={common.loading} style={{ gap: tokens.space['space-3'] }}>
        <Skeleton width="60%" height={28} />
        <Skeleton height={20} />
        <Skeleton width="80%" height={16} />
      </View>
    );
  }

  return (
    <View testID="timeline-summary">
      <Card>{body}</Card>
    </View>
  );
}
