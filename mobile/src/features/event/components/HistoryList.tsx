import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useRefetchOnFocus } from '@/shared/api';
import { EmptyState, ErrorState, Icon, Skeleton, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useTimeline } from '../api/useTimeline';
import { groupByYear } from '../model/display';
import { TimelineItem } from './TimelineItem';

/**
 * A car's history under its heading and entry count, newest first and grouped by year. It sits inside the car screen's own scroll view, so it is a
 * plain column rather than a list; the screen's pull-to-refresh and focus refetch keep it fresh.
 */
export function HistoryList({ vin }: { vin: string }) {
  const timeline = useTimeline(vin);
  useRefetchOnFocus(timeline.refetch);
  const router = useRouter();

  const heading = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="title-lg" accessibilityRole="header">
        {en.vehicle.history}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
        {timeline.data ? (
          <Text variant="caption" color="ink-muted">
            {en.vehicle.historyCount(timeline.data.length)}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en.vehicle.openTimeline}
          onPress={() => router.push(`/vehicles/${vin}/timeline`)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="expand" />
        </Pressable>
      </View>
    </View>
  );

  if (timeline.isPending) {
    return (
      <View style={{ gap: tokens.space['space-3'] }}>
        {heading}
        <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-3'] }}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      </View>
    );
  }
  // Cached rows stay visible when a background refetch fails.
  if (!timeline.data) {
    return (
      <View style={{ gap: tokens.space['space-3'] }}>
        {heading}
        <ErrorState onRetry={() => void timeline.refetch()} />
      </View>
    );
  }
  if (timeline.data.length === 0) {
    return (
      <View style={{ gap: tokens.space['space-3'] }}>
        {heading}
        <EmptyState icon="wrench" title={en.vehicle.noHistoryTitle} body={en.vehicle.noHistoryBody} />
      </View>
    );
  }

  return (
    <View style={{ gap: tokens.space['space-3'] }}>
      {heading}
      {groupByYear(timeline.data).map(({ year, events }) => (
        <View key={year}>
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
