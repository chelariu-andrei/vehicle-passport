import { Field } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { normalisePlate } from '@/shared/viewer';

import type { PanelProps } from './types';

export function PlatePanel({ look, onChange }: PanelProps) {
  return (
    <Field
      label={en.look.plate}
      helper={en.look.plateHelper}
      value={look.plate}
      autoCapitalize="characters"
      autoCorrect={false}
      maxLength={10}
      onChangeText={(text) => onChange({ ...look, plate: normalisePlate(text) })}
    />
  );
}
