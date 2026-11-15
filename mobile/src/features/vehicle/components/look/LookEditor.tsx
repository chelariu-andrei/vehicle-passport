import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';

import { Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { CarViewer } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

import { GlassPanel } from './GlassPanel';
import { PaintPanel } from './PaintPanel';
import { PlatePanel } from './PlatePanel';
import { ShapePanel } from './ShapePanel';
import { TOPICS, TOPIC_VIEW } from './types';
import type { Topic } from './types';
import { WheelsPanel } from './WheelsPanel';

const PANELS = { shape: ShapePanel, paint: PaintPanel, wheels: WheelsPanel, glass: GlassPanel, plate: PlatePanel } as const;
const STAGE_SHARE = 0.28;

/** The stage on top, five topics under it, one panel at a time. */
export function LookEditor({ look, onChange, active }: { look: Look; onChange: (next: Look) => void; active: boolean }) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [topic, setTopic] = useState<Topic>('shape');
  const Panel = PANELS[topic];
  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      <View testID="look-stage" style={{ height: height * STAGE_SHARE, borderRadius: tokens.radius['radius-lg'], overflow: 'hidden' }}>
        <CarViewer look={look} view={TOPIC_VIEW[topic]} active={active} />
      </View>
      <Text variant="caption" color="ink-muted" style={{ textAlign: 'center' }}>
        {en.look.illustrative}
      </Text>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {TOPICS.map((t) => (
          <Pressable
            key={t}
            accessibilityRole="tab"
            accessibilityLabel={en.look.topics[t]}
            accessibilityState={{ selected: t === topic }}
            onPress={() => setTopic(t)}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: tokens.space['space-3'],
              borderBottomWidth: 2,
              borderBottomColor: t === topic ? colors.brand : 'transparent',
            }}
          >
            <Text variant="label" color={t === topic ? 'ink' : 'ink-muted'}>
              {en.look.topics[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Panel look={look} onChange={onChange} />
    </View>
  );
}
