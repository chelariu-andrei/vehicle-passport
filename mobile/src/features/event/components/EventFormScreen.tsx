import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation, usePreventRemove } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { Pressable, ScrollView, View } from 'react-native';

import { errorMessage, qk } from '@/shared/api';
import { ActionBar, AppBar, ConfirmSheet, ErrorState, Field, Icon, Screen, Skeleton, Text, toast, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';
import { useBack } from '@/shared/navigation/useBack';

import { useAddEvent } from '../api/useAddEvent';
import { uploadAttachments } from '../api/useUploadAttachments';
import { useTimeline } from '../api/useTimeline';
import { useUpdateEvent } from '../api/useUpdateEvent';
import { EVENT_TYPES, eventFormSchema, formInputOf, maxEventDate, newFormInput, toEventRequest, typeDefaults } from '../model/eventForm';
import type { EventForm, EventFormInput, EventType } from '../model/eventForm';
import { EVENT_TYPE_CONFIG } from '../model/eventTypes';
import { eventSummary } from '../model/eventSummary';
import { MAX_STAGED } from '../model/stagedFiles';
import type { StagedFile } from '../model/stagedFiles';
import type { EventResponse } from '../model/timeline';
import { AttachmentList } from './AttachmentList';
import { DateField } from './DateField';
import { ComponentPicker } from './details/ComponentPicker';
import { CustomFieldsEditor } from './details/CustomFieldsEditor';
import { InsuranceDetailsFields, PeriodPresets } from './details/InsuranceDetailsFields';
import { ItpDetailsFields } from './details/ItpDetailsFields';
import { RovinietaDetailsFields, RovinietaEndPreview } from './details/RovinietaDetailsFields';
import { SafetyEquipmentDetailsFields } from './details/SafetyEquipmentDetailsFields';
import { DocumentsSection } from './DocumentsSection';

/** The message of the first problem an array field reports, whether on the field or on one of its rows. */
function firstMessage(error: unknown): string | undefined {
  if (Array.isArray(error)) {
    for (const entry of error) {
      const message = firstMessage(entry);
      if (message !== undefined) return message;
    }
    return undefined;
  }
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return undefined;
}

function TypePicker({ value, onChange }: { value: EventType; onChange(type: EventType): void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={en.event.typeLabel}>
      <Text variant="label">{en.event.typeLabel}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {EVENT_TYPES.map((type) => {
          const selected = type === value;
          const config = EVENT_TYPE_CONFIG[type];
          return (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityLabel={config.label()}
              accessibilityState={{ selected }}
              onPress={() => onChange(type)}
              style={{
                flexBasis: '22%',
                flexGrow: 1,
                minHeight: 72,
                padding: tokens.space['space-2'],
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space['space-1'],
                borderRadius: tokens.radius['radius-md'],
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors['line-strong'],
                backgroundColor: selected ? colors['surface-raised'] : 'transparent',
              }}
            >
              <Icon name={config.icon} size={24} color={config.tint} />
              <Text variant="caption" style={{ textAlign: 'center' }}>
                {config.label()}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  // The rules follow the type chosen, so the schema is picked when the form is checked.
  const resolver = useMemo<Resolver<EventFormInput, unknown, EventForm>>(
    () => (values, context, options) => zodResolver(eventFormSchema(values.type, maxDate))(values, context, options) as ReturnType<Resolver<EventFormInput, unknown, EventForm>>,
    [maxDate],
  );
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = useForm<EventFormInput, unknown, EventForm>({
    resolver,
    defaultValues: original ? formInputOf(original) : newFormInput(maxDate),
  });
  const type = useWatch({ control, name: 'type' });
  const validFrom = useWatch({ control, name: 'validFrom' });
  const details = useWatch({ control, name: 'details' });
  const config = EVENT_TYPE_CONFIG[type];
  const usesFrom = config.validity === 'computed' || config.validity === 'range';
  const usesUntil = config.validity === 'untilOptional' || config.validity === 'untilRequired' || config.validity === 'range';
  // Editing clears a settled server error. A request in flight must never be reset: that would detach its callbacks.
  const edited = () => {
    if (save.isError) save.reset();
  };
  const changeType = (next: EventType) => {
    edited();
    clearErrors();
    setValue('type', next);
    const defaults = typeDefaults(next, getValues('date'));
    setValue('customLabel', defaults.customLabel);
    setValue('validFrom', defaults.validFrom);
    setValue('validUntil', defaults.validUntil);
    setValue('details', defaults.details);
    setValue('components', defaults.components);
  };

  const close = useBack('/');
  const [checking, setChecking] = useState<EventForm | null>(null);
  const sent = useRef(false);
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
   * The event is saved now, so it is kept whatever happens here. The files go one at a time; a refused one (a duplicate,
   * say) is skipped, and if the run itself breaks (offline, signed out) every file not yet sent counts as failed.
   * The form closes either way, and a toast says what did not upload.
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
    if (failed > 0) {
      const { failedUploads, duplicateUploads } = en.event.documents;
      toast(duplicates > 0 ? `${failedUploads(failed, files.length)} ${duplicateUploads(duplicates)}` : failedUploads(failed, files.length));
    }
    setExit({ go: close });
  };
  const confirm = () => {
    // A second tap lands before the sheet is gone; only the first may post.
    if (checking === null || sent.current) return;
    sent.current = true;
    const values = checking;
    setChecking(null);
    save.mutate(toEventRequest(original, values), {
      onSuccess: (saved) => {
        if (files.length === 0) return setExit({ go: close });
        // `sent` stays set: the event exists, and a second save would add it again.
        setUploading(true);
        void attach(saved.id);
      },
      onError: () => {
        sent.current = false;
      },
    });
  };

  const text = (name: 'odometerKm' | 'costAmount' | 'currency' | 'notes' | 'customLabel' | 'date'): string | undefined => errors[name]?.message;
  const onChangeOf = (change: (value: string) => void) => (value: string) => {
    edited();
    change(value);
  };

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
          <ReadOnly label={en.event.typeLabel} value={EVENT_TYPE_CONFIG[original.type].label()} />
          <ReadOnly label={en.event.date} value={original.date} />
          <ReadOnly label={en.event.odometer} value={String(original.odometerKm)} />
          <ReadOnly label={en.event.cost} value={`${original.costAmount} ${original.currency}`} />
        </>
      ) : (
        <>
          <Controller
            control={control}
            name="type"
            render={({ field }) => <TypePicker value={field.value} onChange={changeType} />}
          />
          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <DateField
                label={en.event.date}
                accessibilityLabel={en.event.chooseDate(field.value)}
                testID="event-date-picker"
                value={field.value}
                maxDate={maxDate}
                onChange={onChangeOf(field.onChange)}
                error={text('date')}
              />
            )}
          />
          {config.customLabel ? (
            <Controller
              control={control}
              name="customLabel"
              render={({ field }) => (
                <Field label={en.event.customLabel} value={field.value} onChangeText={onChangeOf(field.onChange)} onBlur={field.onBlur} maxLength={60} error={text('customLabel')} />
              )}
            />
          ) : null}
          {config.details === 'INSURANCE' ? (
            <Controller
              control={control}
              name="details"
              render={({ field }) => (
                <InsuranceDetailsFields
                  value={field.value}
                  onChange={(next) => {
                    edited();
                    field.onChange(next);
                  }}
                  insurerError={errors.details?.insurer?.message}
                />
              )}
            />
          ) : null}
          {config.details === 'ROVINIETA' ? (
            <Controller
              control={control}
              name="details"
              render={({ field }) => (
                <RovinietaDetailsFields
                  value={field.value}
                  onChange={(next) => {
                    edited();
                    field.onChange(next);
                  }}
                />
              )}
            />
          ) : null}
          {config.details === 'SAFETY_EQUIPMENT' ? (
            <Controller
              control={control}
              name="details"
              render={({ field }) => (
                <SafetyEquipmentDetailsFields
                  value={field.value}
                  onChange={(next) => {
                    edited();
                    field.onChange(next);
                  }}
                  error={errors.details?.item?.message}
                />
              )}
            />
          ) : null}
          {config.details === 'ITP' ? (
            <Controller
              control={control}
              name="details"
              render={({ field }) => (
                <ItpDetailsFields
                  result={field.value.result}
                  onResult={(result) => {
                    edited();
                    field.onChange({ ...field.value, result });
                  }}
                  station={field.value.station}
                  onStation={(station) => {
                    edited();
                    field.onChange({ ...field.value, station });
                  }}
                />
              )}
            />
          ) : null}
          {usesFrom ? (
            <Controller
              control={control}
              name="validFrom"
              render={({ field }) => (
                <DateField
                  label={en.event.validFrom}
                  accessibilityLabel={en.event.chooseDateFor(en.event.validFrom, field.value)}
                  testID="event-valid-from-picker"
                  value={field.value}
                  onChange={onChangeOf(field.onChange)}
                  error={errors.validFrom?.message}
                />
              )}
            />
          ) : null}
          {config.validity === 'computed' ? <RovinietaEndPreview validFrom={validFrom} duration={details.duration} /> : null}
          {usesUntil ? (
            <Controller
              control={control}
              name="validUntil"
              render={({ field }) => (
                <DateField
                  label={en.event.validUntilField}
                  accessibilityLabel={en.event.chooseDateFor(en.event.validUntilField, field.value)}
                  testID="event-valid-until-picker"
                  value={field.value}
                  onChange={onChangeOf(field.onChange)}
                  onClear={config.validity === 'untilOptional' ? () => field.onChange('') : undefined}
                  error={errors.validUntil?.message}
                />
              )}
            />
          ) : null}
          {config.validity === 'range' ? (
            <PeriodPresets
              validFrom={validFrom}
              onPick={(until) => {
                edited();
                setValue('validUntil', until, { shouldDirty: true });
              }}
            />
          ) : null}
          <Controller
            control={control}
            name="odometerKm"
            render={({ field }) => (
              <Field
                label={en.event.odometer}
                helper={config.odometer === 'optional' ? en.event.optional : undefined}
                value={field.value}
                onChangeText={onChangeOf(field.onChange)}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                maxLength={9}
                error={text('odometerKm')}
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
                onChangeText={onChangeOf(field.onChange)}
                onBlur={field.onBlur}
                keyboardType="decimal-pad"
                error={text('costAmount')}
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
                // The contract takes three capital letters, so the field writes them.
                onChangeText={(next) => onChangeOf(field.onChange)(next.toUpperCase())}
                onBlur={field.onBlur}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={3}
                error={text('currency')}
              />
            )}
          />
        </>
      )}
      <Controller
        control={control}
        name="components"
        render={({ field }) => (
          <ComponentPicker
            value={field.value}
            onChange={(next) => {
              edited();
              field.onChange(next);
            }}
          />
        )}
      />
      <DocumentsSection
        files={files}
        onChange={setFiles}
        disabled={busy}
        capacity={MAX_STAGED - (original?.attachmentCount ?? 0)}
        hint={config.documentHint?.()}
      >
        {original ? <AttachmentList vin={vin} eventId={original.id} count={original.attachmentCount} editable bare /> : null}
      </DocumentsSection>
      <Controller
        control={control}
        name="customFields"
        render={({ field }) => (
          <CustomFieldsEditor
            value={field.value}
            onChange={(next) => {
              edited();
              field.onChange(next);
            }}
            error={firstMessage(errors.customFields)}
            disabled={busy}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <Field
            label={en.event.notes}
            value={field.value}
            onChangeText={onChangeOf(field.onChange)}
            onBlur={field.onBlur}
            multiline
            maxLength={2000}
            error={text('notes')}
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
            ? eventSummary(checking, documents).map((row, index) => (
                <View key={`${index}:${row.label}`} style={{ gap: tokens.space['space-1'] }}>
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
