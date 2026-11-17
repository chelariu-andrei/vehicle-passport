import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';

import { isApiError } from '@/shared/api';
import { AppBar, EmptyState, ErrorState, Screen, Skeleton, Text, tokens, useTheme } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import { useTimelinePages } from '../api/useTimelinePages';
import { useTimelineSummary } from '../api/useTimelineSummary';
import { groupByYear } from '../model/display';
import type { EventResponse } from '../model/timeline';
import { activeCount, EMPTY_FILTERS, pickYear, type TimelineFilters } from '../model/timelineFilters';
import { FilterBar } from './FilterBar';
import { SummaryCard } from './SummaryCard';
import { TimelineRail } from './TimelineRail';
import { YearChips } from './YearChips';

type Section = { title: string; data: EventResponse[] };

/**
 * Every event of a car on a rail, newest first and grouped by year, with year chips, Type/Component/Period filters and a summary
 * of whatever the filters leave. Filters live for as long as the screen does. Pages load as the list nears its end.
 */
export function TimelineScreen({ vin, carName }: { vin: string; carName?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useStrings();
  const [filters, setFilters] = useState<TimelineFilters>(EMPTY_FILTERS);
  const pages = useTimelinePages(vin, filters);
  const summary = useTimelineSummary(vin, filters);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo<Section[]>(
    () => groupByYear(pages.data ?? []).map(({ year, events }) => ({ title: String(year), data: events })),
    [pages.data],
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([pages.refetch(), summary.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!pages.hasNextPage || pages.isFetchingNextPage || pages.isError) return;
    const result = await pages.fetchNextPage();
    // A cursor the server refuses (the history changed under it) restarts from page one.
    if (isApiError(result.error, 'invalid-cursor')) void pages.refetch();
  };

  const filtered = activeCount(filters) > 0;
  let empty: React.ReactElement;
  if (pages.isPending) {
    empty = (
      <View accessible accessibilityLabel={s.common.loading} style={{ gap: tokens.space['space-3'] }}>
        <Skeleton height={64} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    );
  } else if (pages.isError) {
    empty = <ErrorState onRetry={() => void pages.refetch()} />;
  } else if (filtered) {
    empty = (
      <EmptyState
        icon="filter"
        title={s.timeline.noMatchTitle}
        body={s.timeline.noMatchBody}
        action={{ title: s.timeline.clearFilters, onPress: () => setFilters(EMPTY_FILTERS) }}
      />
    );
  } else {
    empty = <EmptyState icon="wrench" title={s.vehicle.noHistoryTitle} body={s.vehicle.noHistoryBody} />;
  }

  const header = (
    <View style={{ gap: tokens.space['space-3'], paddingBottom: tokens.space['space-4'] }}>
      <YearChips years={summary.data?.years ?? []} active={filters.year} onPick={(year) => setFilters((f) => pickYear(f, year))} />
      <FilterBar filters={filters} onChange={setFilters} />
      <SummaryCard summary={summary} />
    </View>
  );

  return (
    <Screen header={<AppBar onBack={() => router.back()} title={carName ? s.timeline.title(carName) : s.vehicle.timelineTitle} />}>
      <SectionList
        testID="timeline-list"
        sections={sections}
        keyExtractor={(event) => event.id}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderSectionHeader={({ section }) => (
          <View testID="timeline-year" style={{ paddingTop: tokens.space['space-4'], paddingBottom: tokens.space['space-1'] }}>
            <Text variant="title" color="ink-muted" accessibilityRole="header">
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => <TimelineRail vin={vin} event={item} first={index === 0} last={index === section.data.length - 1} />}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          pages.isFetchingNextPage ? (
            <View accessible accessibilityLabel={s.timeline.loadingMore} style={{ paddingVertical: tokens.space['space-3'] }}>
              <Skeleton height={64} />
            </View>
          ) : undefined
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.brand} />}
        contentContainerStyle={{ paddingBottom: tokens.space['space-8'] }}
      />
    </Screen>
  );
}
