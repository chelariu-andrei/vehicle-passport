import { View } from 'react-native';

import { tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { Choice, ChoiceRow, Group } from './Choice';
import type { PanelProps } from './types';

const WHEELS = ['FIVE_SPOKE', 'MULTI_SPOKE', 'AERO'] as const;
const RIMS = ['SILVER', 'BLACK', 'BODY'] as const;

export function WheelsPanel({ look, onChange }: PanelProps) {
  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      <Group title={en.look.topics.wheels}>
        <ChoiceRow>
          {WHEELS.map((wheels) => (
            <Choice key={wheels} label={en.look.wheels[wheels]} selected={look.wheels === wheels} onPress={() => onChange({ ...look, wheels })} />
          ))}
        </ChoiceRow>
      </Group>
      <Group title={en.look.rimColour}>
        <ChoiceRow>
          {RIMS.map((rimColor) => (
            <Choice key={rimColor} label={en.look.rims[rimColor]} selected={look.rimColor === rimColor} onPress={() => onChange({ ...look, rimColor })} />
          ))}
        </ChoiceRow>
      </Group>
    </View>
  );
}
