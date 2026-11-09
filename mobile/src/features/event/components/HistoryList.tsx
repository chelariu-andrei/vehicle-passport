import { View } from 'react-native';

import { useRefetchOnFocus } from '@/shared/api';
import { EmptyState, ErrorState, Skeleton, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useTimeline } from '../api/useTimeline';
import { groupByYear } from '../model/display';
import { TimelineItem } from './TimelineItem';

/**
 * A car's history, newest first and grouped by year. It sits inside the vehicle screen's own scroll view, so it is a
 * plain column rather than a list; the screen's pull-to-refresh and focus refetch keep it fresh.
 */
export function HistoryList({ vin }: { vin: string }) {
  const timeline = useTimeline(vin);
  useRefetchOnFocus(timeline.refetch);

  if (timeline.isPending) {
    return (
      <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-3'] }}>
        <Skeleton height={96} />
        <Skeleton height={96} />
      </View>
    );
  }
  // Cached rows stay visible when a background refetch fails.
  if (!timeline.data) return <ErrorState onRetry={() => void timeline.refetch()} />;
  if (timeline.data.length === 0) return <EmptyState icon="wrench" title={en.event.historyEmpty} body={en.event.historyEmptyBody} />;

  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      {groupByYear(timeline.data).map(({ year, events }) => (
        <View key={year} style={{ gap: tokens.space['space-3'] }}>
          <Text variant="title" color="ink-muted" accessibilityRole="header">
            {String(year)}
          </Text>
          {events.map((event) => (
            <TimelineItem key={event.id} vin={vin} event={event} />
          ))}
        </View>
      ))}
    </View>
  );
}
