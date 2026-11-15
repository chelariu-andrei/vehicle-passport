import { View } from 'react-native';

import { Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { PALETTE, paintHex, shade } from '@/shared/viewer';

import { HUE_MAX, LIGHTNESS_MAX, LIGHTNESS_MIN, hueAndLightness } from '../../model/lookColour';
import { Choice, ChoiceRow, Group } from './Choice';
import { Track } from './Track';
import type { PanelProps } from './types';

const FINISHES = ['GLOSS', 'METALLIC', 'SATIN', 'MATTE'] as const;

export function PaintPanel({ look, onChange }: PanelProps) {
  const custom = look.colorHex !== null;
  const { hue, lightness } = hueAndLightness(paintHex(look));
  const setShade = (h: number, l: number) => onChange({ ...look, ...shade(h, l) });
  const filed = PALETTE.find((p) => p.code === look.color)?.name.toLowerCase() ?? '';
  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      <Group title={en.look.topics.paint}>
        <ChoiceRow>
          {PALETTE.map((p) => (
            <Choice
              key={p.code}
              label={p.name}
              selected={!custom && look.color === p.code}
              onPress={() => onChange({ ...look, color: p.code, colorHex: null })}
            >
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: p.hex, borderWidth: 1, borderColor: '#808080' }} />
            </Choice>
          ))}
          <Choice label={en.look.anyColour} selected={custom} onPress={() => setShade(hue, lightness)} />
        </ChoiceRow>
      </Group>
      {custom ? (
        <View style={{ gap: tokens.space['space-2'] }}>
          <Track label={en.look.hue} value={hue} min={0} max={HUE_MAX} step={10} onChange={(h) => setShade(h, lightness)} />
          <Track label={en.look.lightness} value={lightness} min={LIGHTNESS_MIN} max={LIGHTNESS_MAX} step={0.05} onChange={(l) => setShade(hue, l)} />
          <Text variant="caption" color="ink-muted">
            {en.look.filedUnder(filed)}
          </Text>
        </View>
      ) : null}
      <Group title={en.look.finishTitle}>
        <ChoiceRow>
          {FINISHES.map((finish) => (
            <Choice key={finish} label={en.look.finish[finish]} selected={look.finish === finish} onPress={() => onChange({ ...look, finish })} />
          ))}
        </ChoiceRow>
      </Group>
    </View>
  );
}
