import { ScrollView } from 'react-native';

import { FilterChip, tokens } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

type Props = {
  /** Every year with an event, newest first (from the summary). */
  years: readonly number[];
  /** The active year; null is "All years". */
  active: number | null;
  onPick: (year: number | null) => void;
};

/** One chip per year with events, then "All years". One is active at a time. */
export function YearChips({ years, active, onPick }: Props) {
  const t = useStrings().timeline;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={t.years}
      contentContainerStyle={{ gap: tokens.space['space-2'], paddingVertical: tokens.space['space-1'] }}
    >
      {years.map((year) => (
        <FilterChip key={year} label={String(year)} active={active === year} onPress={() => onPick(active === year ? null : year)} />
      ))}
      <FilterChip label={t.allYears} active={active === null} onPress={() => onPick(null)} />
    </ScrollView>
  );
}
