import { View } from 'react-native';

import { tokens, useTheme, type Evidence } from '@/shared/design';

import { EVENT_TYPE_CONFIG } from '../model/eventTypes';
import type { EventResponse } from '../model/timeline';
import { TimelineItem } from './TimelineItem';

const GUTTER = 24;
const LINE = 2;
const DOT = 10;
const RING = 2;
/** The ring sits one gap away from the dot, so a documented dot reads as a target rather than a bigger dot. */
const RING_GAP = 2;
const RING_SIZE = DOT + 2 * (RING + RING_GAP);
/** Evidence a paper (or better) stands behind wears a ring on the rail, as the badge does in the row. */
const RINGED: ReadonlySet<Evidence> = new Set(['DOCUMENTED', 'VERIFIED']);

type Props = {
  vin: string;
  event: EventResponse;
  /** First row under a year header: the line starts at the dot. */
  first: boolean;
  /** Last row of its year: the line stops at the dot, so the rail breaks before the next header. */
  last: boolean;
};

/** One row of the full timeline: a 2px rail in a 24px gutter with a dot in the type's tint, then the compact row's content. */
export function TimelineRail({ vin, event, first, last }: Props) {
  const { colors } = useTheme();
  const tint = colors[EVENT_TYPE_CONFIG[event.type].tint];
  const ringed = RINGED.has(event.evidence);
  const segment = { width: LINE, flex: 1, backgroundColor: colors.line };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: tokens.space['space-2'] }}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: GUTTER, alignItems: 'center' }}>
        <View style={[segment, first ? { backgroundColor: 'transparent' } : null]} />
        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {ringed ? (
            <View
              testID="timeline-rail-ring"
              style={{ position: 'absolute', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2, borderWidth: RING, borderColor: tint }}
            />
          ) : null}
          <View testID="timeline-rail-dot" style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: tint }} />
        </View>
        <View style={[segment, last ? { backgroundColor: 'transparent' } : null]} />
      </View>
      <View style={{ flex: 1 }}>
        <TimelineItem vin={vin} event={event} tile={false} />
      </View>
    </View>
  );
}
