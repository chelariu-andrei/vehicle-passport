import { View } from 'react-native';

import { Button, Card, Icon, Text, toast, tokens } from '@/shared/design';
import { useLocale, useStrings } from '@/shared/i18n';

import { useCancelDeletion, useScheduledDeletion } from '../api/useDeletion';
import { formatDeletionDate } from '../model/deletionDate';

/** Shown on Account and on the delete screen from the moment a deletion is scheduled until it is cancelled. Nothing when none is. */
export function DeletionBanner() {
  const s = useStrings();
  const { locale } = useLocale();
  const scheduledFor = useScheduledDeletion();
  const cancel = useCancelDeletion();
  if (scheduledFor === null) return null;
  return (
    <Card style={{ gap: tokens.space['space-3'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
        <Icon name="alert" size={22} color="danger" />
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
          {s.deletion.scheduledTitle}
        </Text>
      </View>
      <Text color="ink-muted">{s.deletion.scheduledBody(formatDeletionDate(locale, scheduledFor))}</Text>
      <Button
        kind="secondary"
        title={s.deletion.cancel}
        loading={cancel.isPending}
        onPress={() =>
          cancel.mutate(undefined, {
            onSuccess: () => toast(s.deletion.cancelled),
            onError: () => toast(s.deletion.cancelFailed),
          })
        }
      />
    </Card>
  );
}
