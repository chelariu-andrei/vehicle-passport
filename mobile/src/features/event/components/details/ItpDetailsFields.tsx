import { View } from 'react-native';

import type { components } from '@/shared/api/generated/schema';
import { Field, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { Chip, ChipGroup } from './Chip';

export type ItpResult = components['schemas']['ItpResult'];
const RESULTS: readonly ItpResult[] = ['PASSED', 'PASSED_WITH_REMARKS', 'FAILED'];

/**
 * The inspection result, and with `onStation` the station too. The scan review has no station, so it passes only the
 * result. Choosing the selected result again clears it: both are optional.
 */
export function ItpDetailsFields({
  result,
  onResult,
  station,
  onStation,
}: {
  result: ItpResult | '';
  onResult(result: ItpResult | ''): void;
  station?: string;
  onStation?(station: string): void;
}) {
  return (
    <View style={{ gap: tokens.space['space-4'] }}>
      <ChipGroup label={en.event.itpResult} role="radiogroup">
        {RESULTS.map((option) => (
          <Chip key={option} role="radio" label={en.event.itpResultValue[option]} selected={result === option} onPress={() => onResult(result === option ? '' : option)} />
        ))}
      </ChipGroup>
      {onStation ? <Field label={en.event.station} value={station ?? ''} onChangeText={onStation} maxLength={100} /> : null}
    </View>
  );
}
