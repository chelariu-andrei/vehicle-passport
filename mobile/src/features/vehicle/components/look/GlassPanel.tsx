import { Pressable, Switch, View } from 'react-native';

import { Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { Choice, ChoiceRow, Group } from './Choice';
import type { PanelProps } from './types';

const TINTS = ['LIGHT', 'DARK'] as const;

export function GlassPanel({ look, onChange }: PanelProps) {
  const toggle = () => onChange({ ...look, contrastRoof: !look.contrastRoof });
  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      <Group title={en.look.topics.glass}>
        <ChoiceRow>
          {TINTS.map((glassTint) => (
            <Choice key={glassTint} label={en.look.tint[glassTint]} selected={look.glassTint === glassTint} onPress={() => onChange({ ...look, glassTint })} />
          ))}
        </ChoiceRow>
      </Group>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={en.look.roof}
        accessibilityState={{ checked: look.contrastRoof }}
        onPress={toggle}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Text variant="body-lg">{en.look.roof}</Text>
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Switch value={look.contrastRoof} />
        </View>
      </Pressable>
    </View>
  );
}
