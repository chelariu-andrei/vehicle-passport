import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, EvidenceBadge, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { eventMeta, eventTitle } from '../model/display';
import type { EventResponse } from '../model/timeline';

export function TimelineItem({ vin, event }: { vin: string; event: EventResponse }) {
  const router = useRouter();
  const title = eventTitle(event);
  const meta = eventMeta(event);
  return (
    <Pressable
      testID="timeline-item"
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${event.date}, ${meta}, ${en.evidence.a11y(en.evidence[event.evidence])}`}
      onPress={() => router.push(`/vehicles/${vin}/events/${event.id}`)}
      style={{ minHeight: 48 }}
    >
      <Card style={{ gap: tokens.space['space-2'] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: tokens.space['space-3'] }}>
          <Text variant="title" style={{ flexShrink: 1 }}>
            {title}
          </Text>
          <Text variant="caption" color="ink-muted">
            {event.date}
          </Text>
        </View>
        <Text color="ink-muted">{meta}</Text>
        <EvidenceBadge evidence={event.evidence} />
      </Card>
    </Pressable>
  );
}
