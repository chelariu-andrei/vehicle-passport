import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { FieldError, FieldPath } from 'react-hook-form';
import { Image, Pressable, View } from 'react-native';
import type { z } from 'zod';

import { errorMessage, isApiError, qk } from '@/shared/api';
import { Button, ConfirmSheet, ErrorState, Icon, Screen, Skeleton, Text, tokens, useTheme } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { fetchScan, useLocalScan, useScan } from '../api/useScan';
import { useConfirmScan } from '../api/useConfirmScan';
import { useRejectScan } from '../api/useRejectScan';
import { reviewFormSchema, toConfirmRequest, toForm } from '../model/confirmRequest';
import { inboxRow } from '../model/inboxRow';
import { parseFields, REVIEW_EVENT_TYPES } from '../model/parseFields';
import type { EventType, ReviewDraft } from '../model/parseFields';
import type { LocalScanJob } from '../model/scanJobStore';
import { warningField, warningText } from '../model/warnings';
import type { ScanWarning, WarnedField } from '../model/warnings';
import { PartsEditor } from './PartsEditor';
import { ScanFieldRow } from './ScanFieldRow';
import { WarningList } from './WarningList';

type FormInput = z.input<typeof reviewFormSchema>;
type Scan = NonNullable<ReturnType<typeof useScan>['data']>;
type Highlighted = 'date' | 'odometerKm' | 'total';

const r = en.scans.review;

/** What the server refuses at confirm, and the boxes to highlight (integration 3.4.3). */
const REFUSED: Record<string, Highlighted[]> = {
  'odometer-inconsistent': ['odometerKm'],
  'invalid-event': ['date', 'odometerKm', 'total'],
};

const rhfMessage = (error: FieldError | undefined): string | undefined =>
  error === undefined ? undefined : error.type === 'required' ? r.required : r.invalid;

function fileKept(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

function TypePicker({ value, onChange }: { value: EventType; onChange(type: EventType): void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: tokens.space['space-1'] }} accessibilityRole="radiogroup" accessibilityLabel={r.type}>
      <Text variant="label">{r.type}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {REVIEW_EVENT_TYPES.map((type) => {
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

/** The local invoice photo, one tap away. If the file is gone the toggle is not offered and the form works without it. */
function PhotoPreview({ uri }: { uri: string }) {
  const [open, setOpen] = useState(false);
  if (!fileKept(uri)) return null;
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Button kind="secondary" title={open ? r.hidePhoto : r.showPhoto} onPress={() => setOpen((now) => !now)} />
      {open ? (
        <Image
          source={{ uri }}
          accessibilityLabel={en.scans.photoLabel}
          resizeMode="contain"
          style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: tokens.radius['radius-md'] }}
        />
      ) : null}
    </View>
  );
}

type FormProps = { jobId: string; scan: Scan; local: LocalScanJob | undefined; batchmates: LocalScanJob[] };

function Form({ jobId, scan, local, batchmates }: FormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const confirm = useConfirmScan(jobId, local?.vin);
  const reject = useRejectScan(jobId);
  const [rejecting, setRejecting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inFlight = useRef(false);
  const read = useMemo(() => parseFields(scan.fields), [scan.fields]);
  const warnings: ScanWarning[] = scan.warnings;
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, ReviewDraft>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: toForm(read),
  });

  // Editing clears a settled server error. A request in flight must never be reset: that would detach its callbacks.
  const edited = () => {
    if (confirm.isError) confirm.reset();
    if (reject.isError) reject.reset();
  };
  const refusedCode = Object.keys(REFUSED).find((code) => confirm.isError && isApiError(confirm.error, code));
  const refused: Highlighted[] = refusedCode ? REFUSED[refusedCode] : [];
  const refusedMessage = confirm.isError ? errorMessage(confirm.error) : undefined;
  const flagged = (name: Highlighted | 'serviceName' | 'labor') => read[name].flagged;
  const warningOf = (name: WarnedField) => {
    const warning = warnings.find((w) => warningField(w) === name);
    return warning ? warningText(warning) : undefined;
  };
  const problem = (name: Highlighted, error: FieldError | undefined) =>
    rhfMessage(error) ?? (refused.includes(name) ? refusedMessage : undefined);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/scans'));
  /** In a batch the next invoice still waiting for review opens; otherwise back to the inbox. */
  const leave = async () => {
    setLeaving(true);
    for (const mate of batchmates) {
      try {
        const next = await fetchScan(queryClient, mate.jobId);
        if (next.status === 'EXTRACTED') {
          router.replace(`/scans/${mate.jobId}`);
          return;
        }
      } catch {
        // A job the server cannot show right now is skipped; the inbox still lists it.
      }
    }
    close();
  };
  const changed = (error: unknown) => {
    if (isApiError(error, 'scan-state-conflict')) void queryClient.invalidateQueries({ queryKey: qk.scan(jobId) });
  };

  const onValid = (draft: ReviewDraft) => {
    if (inFlight.current) return;
    const request = toConfirmRequest(draft);
    if ('missing' in request) {
      request.missing.forEach((name, i) =>
        setError(name as FieldPath<FormInput>, { type: 'required' }, { shouldFocus: i === 0 }),
      );
      return;
    }
    inFlight.current = true;
    confirm.mutate(request, {
      onSuccess: () => void leave(),
      onError: (error) => {
        inFlight.current = false;
        changed(error);
      },
    });
  };
  const submit = () => void handleSubmit(onValid)();
  const doReject = () => {
    setRejecting(false);
    if (reject.isPending) return;
    reject.mutate(undefined, { onSuccess: () => void leave(), onError: changed });
  };

  const conflict = confirm.isError && isApiError(confirm.error, 'scan-state-conflict');
  const bannerError = confirm.isError && !conflict && refused.length === 0 ? errorMessage(confirm.error) : undefined;
  const rejectError = reject.isError && !isApiError(reject.error, 'scan-state-conflict') ? errorMessage(reject.error) : undefined;

  return (
    <Screen scroll>
      <Text variant="display-xl" accessibilityRole="header">
        {r.title}
      </Text>
      <Text color="ink-muted">{r.intro}</Text>
      {local ? <PhotoPreview uri={local.localUri} /> : null}
      <WarningList warnings={warnings} />
      <Controller
        control={control}
        name="serviceName"
        render={({ field }) => (
          <ScanFieldRow
            label={r.serviceName}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            flagged={flagged('serviceName')}
          />
        )}
      />
      <Controller
        control={control}
        name="date"
        render={({ field }) => (
          <ScanFieldRow
            label={r.date}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            placeholder="2025-01-31"
            autoCorrect={false}
            maxLength={10}
            flagged={flagged('date')}
            warning={warningOf('date')}
            error={problem('date', errors.date)}
          />
        )}
      />
      <Controller
        control={control}
        name="odometerKm"
        render={({ field }) => (
          <ScanFieldRow
            label={r.odometer}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            keyboardType="number-pad"
            maxLength={9}
            flagged={flagged('odometerKm')}
            warning={warningOf('odometerKm')}
            error={problem('odometerKm', errors.odometerKm)}
          />
        )}
      />
      <Controller
        control={control}
        name="total"
        render={({ field }) => (
          <ScanFieldRow
            label={r.total}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            flagged={flagged('total')}
            error={problem('total', errors.total)}
          />
        )}
      />
      <Controller
        control={control}
        name="labor"
        render={({ field }) => (
          <ScanFieldRow
            label={r.labor}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            keyboardType="decimal-pad"
            flagged={flagged('labor')}
            error={rhfMessage(errors.labor)}
          />
        )}
      />
      <Controller
        control={control}
        name="parts"
        render={({ field }) => (
          <PartsEditor
            parts={field.value}
            flagged={read.partsFlagged}
            onChange={(parts) => {
              edited();
              field.onChange(parts);
            }}
            problem={(index, key) => rhfMessage(errors.parts?.[index]?.[key])}
          />
        )}
      />
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
        name="currency"
        render={({ field }) => (
          <ScanFieldRow
            label={r.currency}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text.toUpperCase());
            }}
            onBlur={field.onBlur}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            error={rhfMessage(errors.currency)}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <ScanFieldRow
            label={r.notes}
            value={field.value}
            onChangeText={(text) => {
              edited();
              field.onChange(text);
            }}
            onBlur={field.onBlur}
            multiline
            maxLength={2000}
            error={rhfMessage(errors.notes)}
          />
        )}
      />
      {conflict ? (
        <Text color="danger" accessibilityRole="alert">
          {r.changedTitle}
        </Text>
      ) : null}
      {bannerError ? (
        <Text color="danger" accessibilityRole="alert">
          {bannerError}
        </Text>
      ) : null}
      {rejectError ? (
        <Text color="danger" accessibilityRole="alert">
          {rejectError}
        </Text>
      ) : null}
      <Button title={r.confirm} loading={confirm.isPending || leaving} onPress={submit} />
      <Button kind="danger" title={r.reject} disabled={confirm.isPending || leaving} onPress={() => setRejecting(true)} />
      <ConfirmSheet
        visible={rejecting}
        title={r.rejectTitle}
        body={r.rejectBody}
        confirmLabel={r.rejectConfirm}
        danger
        onConfirm={doReject}
        onCancel={() => setRejecting(false)}
      />
    </Screen>
  );
}

/** A job that is not waiting for review (any more): its current status, and the way back. */
function StatusPanel({ status }: { status: Scan['status'] }) {
  const router = useRouter();
  return (
    <Screen>
      <Text variant="display-xl" accessibilityRole="header">
        {r.title}
      </Text>
      <Text accessibilityRole="alert">{inboxRow(status).label}</Text>
      <Button title={r.backToScans} onPress={() => (router.canGoBack() ? router.back() : router.replace('/scans'))} />
    </Screen>
  );
}

function Loaded({ jobId }: { jobId: string }) {
  const scan = useScan(jobId);
  const local = useLocalScan(jobId);
  if (scan.isError && !scan.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => void scan.refetch()} />
      </Screen>
    );
  }
  if (!scan.data || local.isPending) {
    return (
      <Screen>
        <Skeleton height={48} />
      </Screen>
    );
  }
  if (scan.data.status !== 'EXTRACTED') return <StatusPanel status={scan.data.status} />;
  return <Form jobId={jobId} scan={scan.data} local={local.job} batchmates={local.batchmates} />;
}

/** Review of one extracted invoice. Nothing is saved until Confirm as documented. */
export function ReviewScreen({ jobId }: { jobId: string }) {
  // Keyed, so the next invoice in a batch starts from its own values.
  return <Loaded key={jobId} jobId={jobId} />;
}
