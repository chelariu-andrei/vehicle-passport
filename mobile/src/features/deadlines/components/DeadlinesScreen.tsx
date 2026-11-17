import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useRefetchOnFocus } from '@/shared/api';
import { AppBar, Button, ErrorState, Screen, SettingsGroup, Skeleton, Text, tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';
import { useSettings } from '@/features/settings';

import { useDeadlines, type DeadlineItem } from '../api/useDeadlines';
import { DOCUMENT_CONFIG } from '../model/documentRegistry';
import { DeadlineRow } from './DeadlineRow';

/** Where a tap on a row goes: the current entry, or the new-event form with the document already chosen. */
export function targetFor(vin: string, item: DeadlineItem): string {
  if (item.eventId) return `/vehicles/${vin}/events/${item.eventId}`;
  const { type, coverage, item: equipment } = DOCUMENT_CONFIG[item.kind].preset;
  const params = new URLSearchParams({ type });
  if (coverage) params.set('coverage', coverage);
  if (equipment) params.set('item', equipment);
  return `/vehicles/${vin}/events/new?${params.toString()}`;
}

/** The six documents of one car, each with its status; a tap opens the entry or adds the document. */
export function DeadlinesScreen({ vin, carName }: { vin: string; carName?: string }) {
  const router = useRouter();
  const s = useStrings();
  const deadlines = useDeadlines(vin);
  const settings = useSettings();
  useRefetchOnFocus(deadlines.refetch);
  const prefs = settings.data?.notifications;

  let body: React.ReactElement;
  if (deadlines.isPending) {
    body = (
      <View accessible accessibilityLabel={s.common.loading} style={{ gap: tokens.space['space-3'] }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} height={64} />)}
      </View>
    );
  } else if (deadlines.isError && !deadlines.data) {
    body = <ErrorState title={s.deadlines.loadError} onRetry={() => void deadlines.refetch()} />;
  } else {
    body = (
      <SettingsGroup>
        {(deadlines.data?.items ?? []).map((item) => (
          <DeadlineRow key={item.kind} item={item} onPress={() => router.push(targetFor(vin, item) as never)} />
        ))}
      </SettingsGroup>
    );
  }

  return (
    <Screen scroll header={<AppBar onBack={() => router.back()} title={s.deadlines.title} />}>
      {carName ? (
        <Text variant="caption" color="ink-muted">
          {carName}
        </Text>
      ) : null}
      {body}
      {prefs ? (
        <Text variant="caption" color="ink-muted">
          {prefs.documentDeadlines ? s.deadlines.footerOn([...prefs.reminderDays]) : s.deadlines.footerOff}
        </Text>
      ) : null}
      <Button kind="secondary" title={s.deadlines.settingsButton} onPress={() => router.push('/account/notifications')} />
    </Screen>
  );
}
