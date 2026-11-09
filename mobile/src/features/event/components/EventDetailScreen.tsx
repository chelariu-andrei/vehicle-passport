import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage, useRefetchOnFocus } from '@/shared/api';
import { Button, ConfirmSheet, ErrorState, EvidenceBadge, Screen, Skeleton, Text, toast, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useDeleteEvent } from '../api/useDeleteEvent';
import { useEventDocument } from '../api/useEventDocument';
import { useTimeline } from '../api/useTimeline';
import { eventTitle } from '../model/display';
import { useIsLocked } from '../model/lockedEvents';
import type { EventResponse } from '../model/timeline';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label" color="ink-muted">
        {label}
      </Text>
      <Text variant="body-lg">{value}</Text>
    </View>
  );
}

function Detail({ vin, event }: { vin: string; event: EventResponse }) {
  const router = useRouter();
  const locked = useIsLocked(event.id);
  const document = useEventDocument(vin, event.id, `invoice-${event.id}`);
  const remove = useDeleteEvent(vin, event.id);
  const [confirming, setConfirming] = useState(false);

  const leave = () => (router.canGoBack() ? router.back() : router.replace(`/vehicles/${vin}`));
  const confirmDelete = () => {
    if (remove.isPending) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        leave();
      },
      onError: (error) => {
        setConfirming(false);
        toast(errorMessage(error));
      },
    });
  };

  const parts = event.details?.parts ?? [];
  return (
    <>
      <View style={{ gap: tokens.space['space-2'] }}>
        <Text variant="display" accessibilityRole="header">
          {eventTitle(event)}
        </Text>
        <EvidenceBadge evidence={event.evidence} />
      </View>
      <Fact label={en.event.typeLabel} value={en.event.type[event.type]} />
      <Fact label={en.event.date} value={event.date} />
      <Fact label={en.event.odometer} value={event.odometerKm.toLocaleString('en-US')} />
      <Fact label={en.event.cost} value={`${event.costAmount.toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false })} ${event.currency}`} />
      {event.notes ? <Fact label={en.event.notes} value={event.notes} /> : null}
      <Fact label={en.event.sourceLabel} value={en.event.source[event.source]} />
      {event.details?.serviceName ? <Fact label={en.event.serviceName} value={event.details.serviceName} /> : null}
      {parts.length > 0 ? (
        <View style={{ gap: tokens.space['space-1'] }}>
          <Text variant="label" color="ink-muted">
            {en.event.parts}
          </Text>
          {parts.map((part, index) => (
            <Text key={`${part.name}-${index}`} variant="body-lg">
              {en.event.part(part.name, part.qty, part.price)}
            </Text>
          ))}
        </View>
      ) : null}
      {event.details?.labor != null ? <Fact label={en.event.labor} value={String(event.details.labor)} /> : null}

      {event.documentPresent ? (
        <Button kind="secondary" title={en.event.viewInvoice} loading={document.isPending} onPress={() => document.mutate()} />
      ) : null}
      {document.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorMessage(document.error)}
        </Text>
      ) : null}

      {locked ? null : (
        <View style={{ gap: tokens.space['space-3'] }}>
          <Button title={en.event.edit} onPress={() => router.push(`/vehicles/${vin}/events/${event.id}/edit`)} />
          <Button kind="danger" title={en.event.delete} onPress={() => setConfirming(true)} />
        </View>
      )}

      <ConfirmSheet
        visible={confirming}
        title={en.event.deleteTitle}
        body={en.event.deleteBody}
        confirmLabel={en.event.deleteConfirm}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

export function EventDetailScreen({ vin, eventId }: { vin: string; eventId: string }) {
  const router = useRouter();
  const timeline = useTimeline(vin);
  useRefetchOnFocus(timeline.refetch);
  const event = timeline.data?.find((candidate) => candidate.id === eventId);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/vehicles/${vin}`));

  return (
    <Screen scroll>
      <Button kind="secondary" title={en.common.back} onPress={back} />
      <Text variant="title-lg" color="ink-muted" accessibilityRole="header">
        {en.event.detailTitle}
      </Text>
      {event ? (
        <Detail vin={vin} event={event} />
      ) : timeline.data ? (
        <Text accessibilityRole="alert">{en.errors.codes['event-not-found']}</Text>
      ) : timeline.isError ? (
        <ErrorState onRetry={() => void timeline.refetch()} />
      ) : (
        <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-2'] }}>
          <Skeleton height={32} width="70%" />
          <Skeleton height={20} width="50%" />
        </View>
      )}
    </Screen>
  );
}
