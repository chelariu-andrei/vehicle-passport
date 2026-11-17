import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { formatLocalDate } from '../model/eventForm';

/** A local noon, so that no time zone can move the date the picker shows. */
function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/**
 * The system date picker. With `maxDate` it cannot go past it (the event date: the latest day the server accepts); without,
 * any day may be picked (validity dates lie ahead). An empty `value` shows `en.event.dateNotSet` and opens on today;
 * with `onClear` a chosen date can be taken back.
 */
export function DateField({
  label,
  accessibilityLabel,
  testID,
  value,
  maxDate,
  onChange,
  onClear,
  error,
}: {
  label: string;
  accessibilityLabel: string;
  testID: string;
  value: string;
  maxDate?: string;
  onChange(date: string): void;
  onClear?(): void;
  error?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const shown = value === '' ? formatLocalDate(new Date()) : value;
  const picked = (date: Date) => {
    const next = formatLocalDate(date);
    onChange(maxDate !== undefined && next > maxDate ? maxDate : next);
  };
  const toggle = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: localDate(shown),
        mode: 'date',
        maximumDate: maxDate === undefined ? undefined : localDate(maxDate),
        onChange: ({ type }, date) => {
          if (type === 'set' && date) picked(date);
        },
      });
    } else {
      setOpen((now) => !now);
    }
  };
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={{
            flex: 1,
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: tokens.space['space-4'],
            backgroundColor: colors['surface-raised'],
            borderRadius: tokens.radius['radius-md'],
            borderWidth: 1,
            borderColor: error ? colors.danger : colors['line-strong'],
          }}
        >
          <Text variant="body-lg" color={value === '' ? 'ink-muted' : 'ink'}>
            {value === '' ? en.event.dateNotSet : value}
          </Text>
        </Pressable>
        {onClear && value !== '' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={en.event.clearDate(label)}
            onPress={onClear}
            style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text variant="title">{en.event.documents.removeMark}</Text>
          </Pressable>
        ) : null}
      </View>
      {Platform.OS !== 'android' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable
            accessibilityLabel={en.common.dismiss}
            onPress={() => setOpen(false)}
            style={{ flex: 1, justifyContent: 'center', padding: tokens.space['space-4'], backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {/* Tapping the card itself must not reach the backdrop. */}
            <Pressable
              accessible={false}
              style={{ padding: tokens.space['space-2'], backgroundColor: colors['surface-raised'], borderRadius: tokens.radius['radius-md'] }}
            >
              <DateTimePicker
                testID={testID}
                value={localDate(shown)}
                mode="date"
                display="inline"
                maximumDate={maxDate === undefined ? undefined : localDate(maxDate)}
                onChange={({ type }, date) => {
                  if (type === 'set' && date) {
                    picked(date);
                    setOpen(false);
                  }
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
