import type { ReactElement } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { en } from '../../i18n/en';
import { useTheme } from '../theme';
import { tokens } from '../tokens.generated';
import { ErrorState } from './ErrorState';
import { Skeleton } from './Skeleton';

type QueryState = {
  isPending: boolean;
  isError: boolean;
  isRefetching?: boolean;
  refetch: () => unknown;
};

type Props<T> = {
  query: QueryState;
  data: readonly T[] | undefined;
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  empty: ReactElement;
};

const gap = tokens.space['space-3'];

export function AsyncList<T>({ query, data, keyExtractor, renderItem, empty }: Props<T>) {
  const { colors } = useTheme();

  if (query.isPending) {
    return (
      <View accessible accessibilityLabel={en.common.loading} style={{ gap }}>
        <Skeleton height={96} />
        <Skeleton height={96} />
        <Skeleton height={96} />
      </View>
    );
  }
  // Cached rows stay visible when a background refetch fails; the error state is for a list with nothing to show.
  if (query.isError && !data) return <ErrorState onRetry={() => void query.refetch()} />;

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListEmptyComponent={empty}
      contentContainerStyle={{ gap }}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching ?? false}
          onRefresh={() => void query.refetch()}
          tintColor={colors.brand}
        />
      }
    />
  );
}
