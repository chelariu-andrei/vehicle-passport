import { View } from 'react-native';

import { Card, Icon, Text, tokens } from '@/shared/design';

import { warningField, warningText } from '../model/warnings';
import type { ScanWarning } from '../model/warnings';

/** The scan's warnings, in words. Those that belong to a field are shown on that field instead. */
export function WarningList({ warnings }: { warnings: ScanWarning[] }) {
  const general = warnings.filter((w) => warningField(w) === undefined);
  if (general.length === 0) return null;
  return (
    <Card style={{ gap: tokens.space['space-2'] }}>
      {general.map((w, i) => (
        <View key={`${w.code}-${i}`} style={{ flexDirection: 'row', gap: tokens.space['space-2'], alignItems: 'center' }}>
          <Icon name="alert" size={20} color="warning" />
          <Text style={{ flex: 1 }}>{warningText(w)}</Text>
        </View>
      ))}
    </Card>
  );
}
