import { Text } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { DetailsInput } from '../../model/eventForm';
import { formatDate, rovinietaEnd } from '../../model/validity';
import type { RovinietaDuration } from '../../model/validity';
import { Chip, ChipGroup } from './Chip';

const DURATIONS: readonly RovinietaDuration[] = ['ONE_DAY', 'SEVEN_DAYS', 'THIRTY_DAYS', 'NINETY_DAYS', 'TWELVE_MONTHS'];

/** How long the vignette runs. The end date is the server's to compute; the form only previews it. */
export function RovinietaDetailsFields({ value, onChange }: { value: DetailsInput; onChange(next: DetailsInput): void }) {
  return (
    <ChipGroup label={en.event.duration} role="radiogroup">
      {DURATIONS.map((duration) => (
        <Chip key={duration} role="radio" label={en.event.durationOption[duration]} selected={value.duration === duration} onPress={() => onChange({ ...value, duration })} />
      ))}
    </ChipGroup>
  );
}

/** The read-only end date, shown once the start is chosen. */
export function RovinietaEndPreview({ validFrom, duration }: { validFrom: string; duration: RovinietaDuration }) {
  if (validFrom === '') return null;
  return (
    <Text variant="body-lg" testID="rovinieta-end" accessibilityLiveRegion="polite">
      {en.event.validity.validUntil(formatDate(rovinietaEnd(validFrom, duration)))}
    </Text>
  );
}
