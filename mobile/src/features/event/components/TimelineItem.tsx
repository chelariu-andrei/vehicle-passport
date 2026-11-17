import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EvidenceBadge, Icon, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { COMPONENT_CONFIG } from '../model/components';
import { dayAndMonth } from '../model/display';
import { EVENT_TYPE_CONFIG, eventSubtitle, eventTitle } from '../model/eventTypes';
import type { EventResponse } from '../model/timeline';
import { formatLocalDate } from '../model/eventForm';
import { validityMarker } from '../model/validity';

const MAX_CHIPS = 2;
const TONE_COLOR = { ok: 'evidence-confirmed', warn: 'warning', danger: 'danger' } as const;

/** A 24px icon of the entry's type on a tinted tile. */
function TypeTile({ event }: { event: EventResponse }) {
  const { icon, tint } = EVENT_TYPE_CONFIG[event.type];
  const { colors } = useTheme();
  return (
    <View testID="timeline-type-tile" style={{ width: 40, height: 40, borderRadius: tokens.radius['radius-sm'], alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[tint], opacity: 0.16 }]} />
      <Icon name={icon} size={24} color={tint} />
    </View>
  );
}

/** Up to two component chips and "+n" for the rest. */
function ComponentChips({ components }: { components: EventResponse['components'] }) {
  const { colors } = useTheme();
  if (components.length === 0) return null;
  const shown = components.slice(0, MAX_CHIPS);
  const more = components.length - shown.length;
  const chip = { borderRadius: tokens.radius['radius-pill'], borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingHorizontal: tokens.space['space-2'] };
  return (
    <View testID="timeline-components" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-1'] }}>
      {shown.map((component) => (
        <View key={component} style={chip}>
          <Text variant="caption" color="ink-muted">
            {COMPONENT_CONFIG[component].label()}
          </Text>
        </View>
      ))}
      {more > 0 ? (
        <View style={chip}>
          <Text variant="caption" color="ink-muted">{`+${more}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** One entry: day and month, a type tile, title and subtitle from the registry, the validity marker, component chips, attachments and the evidence badge. A hairline separates rows; there is no box. */
export function TimelineItem({ vin, event }: { vin: string; event: EventResponse }) {
  const router = useRouter();
  const { colors } = useTheme();
  const title = eventTitle(event);
  const meta = eventSubtitle(event);
  const marker = validityMarker(event, formatLocalDate(new Date()));
  const { day, month } = dayAndMonth(event.date);
  return (
    <Pressable
      testID="timeline-item"
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${event.date}, ${meta}${marker ? `, ${marker.text}` : ''}, ${en.evidence.a11y(en.evidence[event.evidence])}${event.attachmentCount > 0 ? `, ${en.event.documents.count(event.attachmentCount)}` : ''}`}
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
      <TypeTile event={event} />
      <View style={{ flex: 1, gap: tokens.space['space-1'] }}>
        <Text variant="title">{title}</Text>
        <Text color="ink-muted">{meta}</Text>
        {marker ? (
          <Text variant="caption" color={TONE_COLOR[marker.tone]}>
            {marker.text}
          </Text>
        ) : null}
        <ComponentChips components={event.components} />
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
