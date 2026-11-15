import { View } from 'react-native';

import { en } from '@/shared/i18n/en';
import { BODY_TYPES, CarSilhouette } from '@/shared/viewer';

import { Choice, ChoiceRow } from './Choice';
import type { PanelProps } from './types';

export function ShapePanel({ look, onChange }: PanelProps) {
  return (
    <ChoiceRow>
      {BODY_TYPES.map((bodyType) => (
        <Choice key={bodyType} label={en.look.body[bodyType]} selected={look.bodyType === bodyType} onPress={() => onChange({ ...look, bodyType })}>
          <View pointerEvents="none">
            <CarSilhouette look={{ ...look, bodyType }} width={56} />
          </View>
        </Choice>
      ))}
    </ChoiceRow>
  );
}
