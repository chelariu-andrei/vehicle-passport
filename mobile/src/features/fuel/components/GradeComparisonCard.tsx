import { View } from 'react-native';

import type { components } from '@/shared/api/generated/schema';
import { Card, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

type GradeComparison = components['schemas']['FuelGradeComparison'];

/** Standard and Premium side by side, with a neutral caption: no verdict on which is worth it. */
export function GradeComparisonCard({ rows, format }: { rows: GradeComparison[]; format(consumption: number): string }) {
  const s = en.fuelLog.stats;
  const count = (grade: GradeComparison['grade']) => rows.find((r) => r.grade === grade)?.segmentCount ?? 0;
  return (
    <Card style={{ gap: tokens.space['space-2'] }}>
      <Text variant="title" accessibilityRole="header">
        {s.gradeTitle}
      </Text>
      {rows.map((row) => (
        <View key={row.grade} style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-3'], minHeight: 32 }}>
          <Text style={{ flex: 1 }}>{en.fuelLog.grade[row.grade]}</Text>
          <Text variant="label">{format(row.avgConsumption)}</Text>
          <Text variant="caption" color="ink-muted">
            {s.gradeTanks(row.segmentCount)}
          </Text>
        </View>
      ))}
      <Text variant="caption" color="ink-muted">
        {s.gradeCaption(count('STANDARD'), count('PREMIUM'))}
      </Text>
    </Card>
  );
}
