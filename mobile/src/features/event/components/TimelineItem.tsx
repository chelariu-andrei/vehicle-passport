import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EvidenceBadge, Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { dayAndMonth, eventMeta, eventTitle } from '../model/display';
import type { EventResponse } from '../model/timeline';

/** One entry: day and month, title, odometer and cost, the evidence badge. A hairline separates rows; there is no box. */
export function TimelineItem({ vin, event }: { vin: string; event: EventResponse }) {
  const router = useRouter();
  const { colors } = useTheme();
  const title = eventTitle(event);
  const meta = eventMeta(event);
  const { day, month } = dayAndMonth(event.date);
  return (
    <Pressable
      testID="timeline-item"
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${event.date}, ${meta}, ${en.evidence.a11y(en.evidence[event.evidence])}${event.attachmentCount > 0 ? `, ${en.event.documents.count(event.attachmentCount)}` : ''}`}
      onPress={() => router.push(`/vehicles/${vin}/events/${event.id}`)}
      style={{
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space['space-3'],
        paddingVertical: tokens.space['space-3'],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.line,
      }}
    >
      <View style={{ width: 44, alignItems: 'center' }}>
        <Text variant="title">{day}</Text>
        <Text variant="caption" color="ink-muted">
          {month}
        </Text>
      </View>
      <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
        <Text variant="title">{title}</Text>
        <Text color="ink-muted">{meta}</Text>
      </View>
      {event.attachmentCount > 0 ? (
        <View testID="timeline-attachments" style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
          <Icon name="clip" size={16} color="ink-muted" />
          <Text variant="caption" color="ink-muted">
            {event.attachmentCount}
          </Text>
        </View>
      ) : null}
      <EvidenceBadge evidence={event.evidence} />
    </Pressable>
  );
}
