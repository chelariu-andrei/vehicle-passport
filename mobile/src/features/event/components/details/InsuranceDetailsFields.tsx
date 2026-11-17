import { View } from 'react-native';

import { Field, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { DetailsInput } from '../../model/eventForm';
import { monthsEnd } from '../../model/validity';
import { Chip, ChipGroup } from './Chip';

const COVERAGES = ['RCA', 'CASCO'] as const;
const PRESET_MONTHS = [1, 6, 12] as const;

/** Coverage, insurer and policy number. The period is the form's validity section. */
export function InsuranceDetailsFields({
  value,
  onChange,
  insurerError,
}: {
  value: DetailsInput;
  onChange(next: DetailsInput): void;
  insurerError?: string;
}) {
  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      <ChipGroup label={en.event.coverage} role="radiogroup">
        {COVERAGES.map((coverage) => (
          <Chip key={coverage} role="radio" label={en.event.coverageValue[coverage]} selected={value.coverage === coverage} onPress={() => onChange({ ...value, coverage })} />
        ))}
      </ChipGroup>
      <Field label={en.event.insurer} value={value.insurer} onChangeText={(insurer) => onChange({ ...value, insurer })} maxLength={100} error={insurerError} />
      <Field label={en.event.policyNumber} value={value.policyNumber} onChangeText={(policyNumber) => onChange({ ...value, policyNumber })} maxLength={60} autoCapitalize="characters" />
    </View>
  );
}

/** 1, 6 and 12 months from `validFrom`; each one fills the end date, which stays editable. */
export function PeriodPresets({ validFrom, onPick }: { validFrom: string; onPick(validUntil: string): void }) {
  if (validFrom === '') return null;
  return (
    <ChipGroup label={en.event.insurancePresets} role="group">
      {PRESET_MONTHS.map((months) => (
        <Chip key={months} role="checkbox" label={en.event.presetMonths(months)} selected={false} onPress={() => onPick(monthsEnd(validFrom, months))} />
      ))}
    </ChipGroup>
  );
}
