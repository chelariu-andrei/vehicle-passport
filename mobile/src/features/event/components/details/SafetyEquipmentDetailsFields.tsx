import type { DetailsInput } from '../../model/eventForm';
import { en } from '@/shared/i18n/en';

import { Chip, ChipGroup } from './Chip';

const ITEMS = ['FIRE_EXTINGUISHER', 'FIRST_AID_KIT'] as const;

/** Which piece of safety equipment the entry is about. */
export function SafetyEquipmentDetailsFields({
  value,
  onChange,
  error,
}: {
  value: DetailsInput;
  onChange(next: DetailsInput): void;
  error?: string;
}) {
  return (
    <ChipGroup label={en.event.safetyItemLabel} role="radiogroup" error={error}>
      {ITEMS.map((item) => (
        <Chip key={item} role="radio" label={en.event.safetyItem[item]} selected={value.item === item} onPress={() => onChange({ ...value, item })} />
      ))}
    </ChipGroup>
  );
}
