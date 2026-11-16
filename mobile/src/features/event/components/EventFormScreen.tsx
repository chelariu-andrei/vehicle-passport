import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import type { z } from 'zod';

import { errorMessage, qk } from '@/shared/api';
import { ActionBar, AppBar, ConfirmSheet, ErrorState, Field, Icon, Screen, Skeleton, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { useBack } from '@/shared/navigation/useBack';

import { useAddEvent } from '../api/useAddEvent';
import { uploadAttachments } from '../api/useUploadAttachments';
import { useTimeline } from '../api/useTimeline';
import { useUpdateEvent } from '../api/useUpdateEvent';
import { EVENT_TYPES, eventFormSchema, formatLocalDate, maxEventDate, toEventRequest } from '../model/eventForm';
import type { EventForm, EventType } from '../model/eventForm';
import { eventSummary } from '../model/eventSummary';
import type { StagedFile } from '../model/stagedFiles';
import type { EventResponse } from '../model/timeline';
import { DocumentsSection } from './DocumentsSection';

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
                testID="event-date-picker"
                value={localDate(value)}
                mode="date"
                display="inline"
                maximumDate={localDate(maxDate)}
                onChange={(event, date) => {
                  if (event.type === 'set' && date) {
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

  const close = useBack('/');
  const [checking, setChecking] = useState<EventForm | null>(null);
  const sent = useRef(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const documents = files.length;
  // Leaving mid-save would drop the staged files or navigate over whatever the person opened, so back waits until the flow is done.
  const busy = save.isPending || uploading;
  // A native guard, so the iOS edge swipe and the Android button are held back before they start.
  usePreventRemove(busy, () => {});
  const navigation = useNavigation<{ setOptions(options: { gestureEnabled: boolean }): void }>();
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy });
  }, [navigation, busy]);
  // Leaving is done after the render that lifts the guard, or the guard would still hold the pop.
  const [exit, setExit] = useState<{ go(): void } | null>(null);
  useEffect(() => {
    if (exit && !busy) exit.go();
  }, [exit, busy]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const leave = () => {
    if (!busy) close();
  };
  const submit = handleSubmit((values) => {
    if (!uploading) setChecking(values);
  });

  /**
   * The event exists now, so it is kept whatever happens here. The files go one at a time; a refused one (a duplicate,
   * say) is skipped, and if the run itself breaks (offline, signed out) every file not yet sent counts as failed.
   */
  const attach = async (eventId: string) => {
    let failed = 0;
    let duplicates = 0;
    try {
      for (const [index, file] of files.entries()) {
        try {
          const outcome = await uploadAttachments(vin, eventId, [file]);
          for (const problem of outcome.failed) {
            failed += 1;
            if (problem.code === 'duplicate-document') duplicates += 1;
          }
        } catch {
          failed += files.length - index;
          break;
        }
      }
      await Promise.all([queryClient.invalidateQueries({ queryKey: qk.timeline(vin) }), queryClient.invalidateQueries({ queryKey: qk.attachments(vin, eventId) })]);
    } finally {
      if (mounted.current) setUploading(false);
    }
    if (!mounted.current) return;
    if (failed === 0) return setExit({ go: close });
    setExit({
      go: () =>
        router.replace({ pathname: '/vehicles/[vin]/events/[eventId]', params: { vin, eventId, failedUploads: String(failed), totalUploads: String(files.length), duplicateUploads: String(duplicates) } }),
    });
  };
  const confirm = () => {
    // A second tap lands before the sheet is gone; only the first may post.
    if (checking === null || sent.current) return;
    sent.current = true;
    const values = checking;
    setChecking(null);
    save.mutate(toEventRequest(original, values), {
      onSuccess: (saved) => {
        if (original || files.length === 0) return setExit({ go: close });
        // `sent` stays set: the event exists, and a second save would add it again.
        setUploading(true);
        void attach(saved.id);
      },
      onError: () => {
        sent.current = false;
      },
    });
  };
  const problem = (field: FieldName): string | undefined => (errors[field] === undefined ? undefined : PROBLEMS[field]);

  return (
    <Screen
      scroll
      header={<AppBar onBack={leave} />}
      footer={<ActionBar primary={{ title: en.event.save, loading: save.isPending || uploading, onPress: submit }} />}
    >
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
      {original ? null : <DocumentsSection files={files} onChange={setFiles} disabled={save.isPending || uploading} />}
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
      <ConfirmSheet
        visible={checking !== null}
        title={en.event.check.title}
        body={en.event.check.body}
        confirmLabel={en.event.check.confirm}
        dismissLabel={en.event.check.back}
        onConfirm={confirm}
        onCancel={() => setChecking(null)}
      >
        {/* Long notes scroll here, so the buttons below stay on screen. */}
        <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: tokens.space['space-3'] }}>
          {checking
            ? eventSummary(checking, documents).map((row) => (
                <View key={row.label} style={{ gap: tokens.space['space-1'] }}>
                  <Text variant="label" color="ink-muted">
                    {row.label}
                  </Text>
                  <Text variant={row.emphasis ? 'title-lg' : 'body-lg'}>{row.value}</Text>
                </View>
              ))
            : null}
        </ScrollView>
      </ConfirmSheet>
    </Screen>
  );
}

/** Adds an event, or with `eventId` edits one. The original comes from the timeline already loaded for the car. */
export function EventFormScreen({ vin, eventId }: { vin: string; eventId?: string }) {
  const back = useBack('/');
  const timeline = useTimeline(vin);
  if (eventId === undefined) return <Form vin={vin} original={null} />;
  const original = timeline.data?.find((event) => event.id === eventId);
  if (original) return <Form vin={vin} original={original} />;
  return (
    <Screen header={<AppBar onBack={back} />}>
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
