import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, View } from 'react-native';
import type { z } from 'zod';

import { errorMessage } from '@/shared/api';
import { Button, ErrorState, Field, Icon, Screen, Skeleton, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { useAddEvent } from '../api/useAddEvent';
import { useTimeline } from '../api/useTimeline';
import { useUpdateEvent } from '../api/useUpdateEvent';
import { EVENT_TYPES, eventFormSchema, formatLocalDate, maxEventDate, toEventRequest } from '../model/eventForm';
import type { EventForm, EventType } from '../model/eventForm';
import type { EventResponse } from '../model/timeline';

type FormInput = z.input<ReturnType<typeof eventFormSchema>>;
type FieldName = 'date' | 'odometerKm' | 'costAmount' | 'currency' | 'notes';

const PROBLEMS: Record<FieldName, string> = {
  date: en.event.invalidDate,
  odometerKm: en.event.invalidOdometer,
  costAmount: en.event.invalidCost,
  currency: en.event.invalidCurrency,
  notes: en.event.notesTooLong,
};

/** A local noon, so that no time zone can move the date the picker shows. */
function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function TypePicker({ value, onChange }: { value: EventType; onChange(type: EventType): void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={en.event.typeLabel}>
      <Text variant="label">{en.event.typeLabel}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {EVENT_TYPES.map((type) => {
          const selected = type === value;
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityLabel={en.event.type[type]}
              accessibilityState={{ selected }}
              onPress={() => onChange(type)}
              style={{
                minHeight: 48,
                minWidth: 48,
                paddingHorizontal: tokens.space['space-4'],
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space['space-1'],
                borderRadius: tokens.radius['radius-pill'],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
                backgroundColor: selected ? colors['surface-raised'] : 'transparent',
              }}
            >
              {selected ? <Icon name="check" size={16} color="brand" /> : null}
              <Text variant="label">{en.event.type[type]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The system date picker. It cannot go past `maxDate`, which is the latest day the server accepts. */
function DateField({ value, maxDate, onChange, error }: { value: string; maxDate: string; onChange(date: string): void; error?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const picked = (date: Date) => {
    const next = formatLocalDate(date);
    onChange(next > maxDate ? maxDate : next);
  };
  const toggle = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: localDate(value),
        mode: 'date',
        maximumDate: localDate(maxDate),
        onChange: (event, date) => {
          if (event.type === 'set' && date) picked(date);
        },
      });
    } else {
      setOpen((now) => !now);
    }
  };
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label">{en.event.date}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={en.event.chooseDate(value)}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={{
          minHeight: 48,
          justifyContent: 'center',
          paddingHorizontal: tokens.space['space-4'],
          backgroundColor: colors['surface-raised'],
          borderRadius: tokens.radius['radius-md'],
          borderWidth: 1,
          borderColor: error ? colors.danger : colors['line-strong'],
        }}
      >
        <Text variant="body-lg">{value}</Text>
      </Pressable>
      {open && Platform.OS !== 'android' ? (
        <DateTimePicker
          testID="event-date-picker"
          value={localDate(value)}
          mode="date"
          display="inline"
          maximumDate={localDate(maxDate)}
          onChange={(event, date) => {
            if (event.type === 'set' && date) picked(date);
          }}
        />
      ) : null}
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: tokens.space['space-1'] }}>
      <Text variant="label" color="ink-muted">
        {label}
      </Text>
      <Text variant="body-lg">{value}</Text>
    </View>
  );
}

function Form({ vin, original }: { vin: string; original: EventResponse | null }) {
  const router = useRouter();
  const add = useAddEvent(vin);
  const update = useUpdateEvent(vin, original?.id ?? '');
  const save = original ? update : add;
  const documented = original?.evidence === 'DOCUMENTED';
  const maxDate = useMemo(() => maxEventDate(new Date()), []);
  const schema = useMemo(() => eventFormSchema(maxDate), [maxDate]);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, EventForm>({
    resolver: zodResolver(schema),
    defaultValues: original
      ? {
          type: original.type,
          date: original.date,
          odometerKm: String(original.odometerKm),
          costAmount: String(original.costAmount),
          currency: original.currency,
          notes: original.notes ?? '',
        }
      : { type: 'SERVICE', date: maxDate, odometerKm: '', costAmount: '', currency: 'RON', notes: '' },
  });
  // Editing clears a settled server error. A request in flight must never be reset: that would detach its callbacks.
  const edited = () => {
    if (save.isError) save.reset();
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace(`/vehicles/${vin}`));
  const submit = handleSubmit((values) => {
    save.mutate(toEventRequest(original, values), { onSuccess: close });
  });
  const problem = (field: FieldName): string | undefined => (errors[field] === undefined ? undefined : PROBLEMS[field]);

  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {original ? en.event.editTitle : en.event.addTitle}
      </Text>
      {documented ? (
        <>
          <Text color="ink-muted">{en.event.documentedNote}</Text>
          <ReadOnly label={en.event.typeLabel} value={en.event.type[original.type]} />
          <ReadOnly label={en.event.date} value={original.date} />
          <ReadOnly label={en.event.odometer} value={String(original.odometerKm)} />
          <ReadOnly label={en.event.cost} value={`${original.costAmount} ${original.currency}`} />
        </>
      ) : (
        <>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <TypePicker
                value={field.value}
                onChange={(type) => {
                  edited();
                  field.onChange(type);
                }}
              />
            )}
          />
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                value={field.value}
                maxDate={maxDate}
                onChange={(date) => {
                  edited();
                  field.onChange(date);
                }}
                error={problem('date')}
              />
            )}
          />
          <Controller
            control={control}
            name="odometerKm"
            render={({ field }) => (
              <Field
                label={en.event.odometer}
                value={field.value}
                onChangeText={(text) => {
                  edited();
                  field.onChange(text);
                }}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                maxLength={9}
                error={problem('odometerKm')}
              />
            )}
          />
          <Controller
            control={control}
            name="costAmount"
            render={({ field }) => (
              <Field
                label={en.event.cost}
                value={field.value}
                onChangeText={(text) => {
                  edited();
                  field.onChange(text);
                }}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                error={problem('costAmount')}
              />
            )}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Field
                label={en.event.currency}
                value={field.value}
                onChangeText={(text) => {
                  edited();
                  // The contract takes three capital letters, so the field writes them.
                  field.onChange(text.toUpperCase());
                }}
                onBlur={field.onBlur}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                error={problem('currency')}
              />
            )}
          />
        </>
      )}
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Field
            label={en.event.notes}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            multiline
            maxLength={2000}
            error={problem('notes')}
          />
        )}
      />
      {save.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorMessage(save.error)}
        </Text>
      ) : null}
      <Button title={en.event.save} loading={save.isPending} onPress={submit} />
      <Button kind="secondary" title={en.common.cancel} onPress={close} />
    </Screen>
  );
}

/** Adds an event, or with `eventId` edits one. The original comes from the timeline already loaded for the car. */
export function EventFormScreen({ vin, eventId }: { vin: string; eventId?: string }) {
  const timeline = useTimeline(vin);
  if (eventId === undefined) return <Form vin={vin} original={null} />;
  const original = timeline.data?.find((event) => event.id === eventId);
  if (original) return <Form vin={vin} original={original} />;
  return (
    <Screen>
      {timeline.data ? (
        <Text accessibilityRole="alert">{en.errors.codes['event-not-found']}</Text>
      ) : timeline.isError ? (
        <ErrorState onRetry={() => void timeline.refetch()} />
      ) : (
        <Skeleton height={48} />
      )}
    </Screen>
  );
}
