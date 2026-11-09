import { View } from 'react-native';

import { Button, Icon, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { ScanFieldRow } from './ScanFieldRow';

export type PartInput = { name: string; qty: string; price: string };
type PartKey = keyof PartInput;

type Props = {
  parts: PartInput[];
  flagged: boolean;
  onChange(parts: PartInput[]): void;
  /** The message for one box, if it is highlighted. */
  problem(index: number, key: PartKey): string | undefined;
};

/** The invoice's parts, each row editable. A row can be removed and a new one added. */
export function PartsEditor({ parts, flagged, onChange, problem }: Props) {
  const r = en.scans.review;
  const edit = (index: number, key: PartKey, value: string) =>
    onChange(parts.map((part, i) => (i === index ? { ...part, [key]: value } : part)));
  return (
    <View style={{ gap: tokens.space['space-3'] }}>
      <Text variant="title" accessibilityRole="header">
        {r.partsTitle}
      </Text>
      {flagged ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-1'] }}>
          <Icon name="alert" size={16} color="warning" />
          <Text variant="caption" color="warning">
            {r.check}
          </Text>
        </View>
      ) : null}
      {parts.length === 0 ? <Text color="ink-muted">{r.noParts}</Text> : null}
      {parts.map((part, i) => (
        <View key={i} style={{ gap: tokens.space['space-2'] }}>
          <ScanFieldRow
            label={r.partName(i + 1)}
            value={part.name}
            onChangeText={(text) => edit(i, 'name', text)}
            error={problem(i, 'name')}
          />
          <ScanFieldRow
            label={r.partQty(i + 1)}
            value={part.qty}
            onChangeText={(text) => edit(i, 'qty', text)}
            keyboardType="decimal-pad"
            error={problem(i, 'qty')}
          />
          <ScanFieldRow
            label={r.partPrice(i + 1)}
            value={part.price}
            onChangeText={(text) => edit(i, 'price', text)}
            keyboardType="decimal-pad"
            error={problem(i, 'price')}
          />
          <Button kind="secondary" title={r.removePart(i + 1)} onPress={() => onChange(parts.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Button kind="secondary" title={r.addPart} onPress={() => onChange([...parts, { name: '', qty: '', price: '' }])} />
    </View>
  );
}
