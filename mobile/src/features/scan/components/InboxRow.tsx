import { Image, Pressable, View } from 'react-native';

import { Button, Card, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { InboxRowModel } from '../api/useScanJobs';

type Props = {
  row: InboxRowModel;
  vehicleName: string;
  busy: boolean;
  onReview(): void;
  onRetry(): void;
  onEnterByHand(): void;
  onDismiss(): void;
};

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** One submitted invoice: its photo, car, status and the one action that status allows. */
export function InboxRow({ row, vehicleName, busy, onReview, onRetry, onEnterByHand, onDismiss }: Props) {
  const body = (
    <Card style={{ gap: tokens.space['space-3'] }}>
      <View style={{ flexDirection: 'row', gap: tokens.space['space-3'] }}>
        <Image
          source={{ uri: row.localUri }}
          accessibilityLabel={en.scans.photoLabel}
          style={{ width: 56, height: 72, borderRadius: tokens.radius['radius-md'] }}
        />
        <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
          <Text variant="title">{row.label}</Text>
          <Text color="ink-muted">{vehicleName}</Text>
          <Text variant="caption" color="ink-muted">
            {en.scans.submitted(when(row.submittedAt))}
          </Text>
        </View>
      </View>
      {row.action === 'failed' ? (
        <View style={{ gap: tokens.space['space-2'] }}>
          {row.canRetry ? <Button title={en.scans.retry} loading={busy} onPress={onRetry} /> : null}
          <Button kind="secondary" title={en.scans.enterByHand} onPress={onEnterByHand} />
        </View>
      ) : null}
      {row.action === 'dismiss' ? <Button kind="secondary" title={en.scans.dismiss} onPress={onDismiss} /> : null}
    </Card>
  );

  if (row.action !== 'review') return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${row.label}, ${vehicleName}`} onPress={onReview}>
      {body}
    </Pressable>
  );
}
