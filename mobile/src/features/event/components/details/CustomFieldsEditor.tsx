import { Pressable, View } from 'react-native';

import { Button, Field, Text, tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { MAX_CUSTOM_FIELDS } from '../../model/eventForm';

type Row = { label: string; value: string };

/** Name and value rows, added and removed one at a time, up to ten. Display-only text the server never interprets. */
export function CustomFieldsEditor({
  value,
  onChange,
  error,
  disabled = false,
}: {
  value: Row[];
  onChange(next: Row[]): void;
  error?: string;
  disabled?: boolean;
}) {
  const change = (index: number, patch: Partial<Row>) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const full = value.length >= MAX_CUSTOM_FIELDS;
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="label">{en.event.customFields}</Text>
      {value.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: tokens.space['space-2'] }}>
          <View style={{ flex: 1 }}>
            <Field label={en.event.customFieldName(index + 1)} value={row.label} onChangeText={(label) => change(index, { label })} maxLength={40} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={en.event.customFieldValue(index + 1)} value={row.value} onChangeText={(next) => change(index, { value: next })} maxLength={200} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={en.event.removeCustomField(index + 1)}
            disabled={disabled}
            onPress={() => onChange(value.filter((_, i) => i !== index))}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="title">{en.event.documents.removeMark}</Text>
          </Pressable>
        </View>
      ))}
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {full ? (
        <Text variant="caption" color="ink-muted">
          {en.event.customFieldsFull}
        </Text>
      ) : (
        <Button kind="secondary" title={en.event.addCustomField} disabled={disabled} onPress={() => onChange([...value, { label: '', value: '' }])} />
      )}
    </View>
  );
}
