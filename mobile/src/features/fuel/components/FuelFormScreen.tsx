import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DateField, formatLocalDate, maxEventDate } from '@/features/event';
import { errorMessage, isApiError, useIsOnline } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';
import { ActionBar, AppBar, ConfirmSheet, ErrorState, Field, FilterChip, Icon, Screen, Skeleton, Switch, Text, toast, tokens, useTheme } from '@/shared/design';
import { useLocale } from '@/shared/i18n';
import { en } from '@/shared/i18n/en';
import { useBack } from '@/shared/navigation/useBack';

import { useAddFuelEntry } from '../api/useAddFuelEntry';
import { useDeleteFuelEntry } from '../api/useDeleteFuelEntry';
import { useFuelEntries, type FuelEntry } from '../api/useFuelEntries';
import { useFuelStats } from '../api/useFuelStats';
import { useUpdateFuelEntry } from '../api/useUpdateFuelEntry';
import { formOfEntry, fuelTypeChoice, initialForm } from '../model/fuelDefaults';
import { formatConsumption, formatKm } from '../model/fuelDisplay';
import { editAmount, toFuelEntryRequest, validateFuelForm } from '../model/fuelForm';
import type { AmountField, ChargeType, FuelEntryType, FuelFormState, FuelGrade } from '../model/fuelForm';

type VehicleFuel = components['schemas']['FuelType'];

const f = en.fuelLog.form;
const GRADES: FuelGrade[] = ['STANDARD', 'PREMIUM'];
const CHARGES: ChargeType[] = ['HOME', 'AC_PUBLIC', 'DC_FAST'];
const AMOUNTS: AmountField[] = ['quantity', 'unitPrice', 'total'];

/** A query that has an answer, or has given up for now (failed, or paused offline). */
const settled = (q: { isPending: boolean; fetchStatus: string }) => !q.isPending || q.fetchStatus !== 'fetching';

function ChipGroup<T extends string>({ label, options, value, labelOf, onChange }: {
  label: string;
  options: T[];
  value: T | null;
  labelOf(option: T): string;
  onChange(next: T | null): void;
}) {
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {options.map((option) => (
          <FilterChip key={option} label={labelOf(option)} active={option === value} onPress={() => onChange(option === value ? null : option)} />
        ))}
      </View>
    </View>
  );
}

/** The date as a chip next to the title: "Today", or the chosen day. It opens More details, where the date is changed. */
function DateChip({ date, today, onPress }: { date: string; today: string; onPress(): void }) {
  const { colors } = useTheme();
  const shown = date === today ? f.today : date;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={f.dateChip(shown)}
      onPress={onPress}
      hitSlop={4}
      style={{
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: tokens.space['space-3'],
        borderRadius: tokens.radius['radius-pill'],
        borderWidth: 1,
        borderColor: colors['line-strong'],
      }}
    >
      <Text variant="label">{shown}</Text>
    </Pressable>
  );
}

type FormProps = {
  vin: string;
  vehicleFuel: VehicleFuel;
  initial: FuelFormState;
  original: FuelEntry | null;
  lastKm: number | null;
  today: string;
};

function Form({ vin, vehicleFuel, initial, original, lastKm, today }: FormProps) {
  const { locale } = useLocale();
  const online = useIsOnline();
  const back = useBack(`/vehicles/${vin}/fuel` as never);
  const add = useAddFuelEntry(vin);
  const update = useUpdateFuelEntry(vin, original?.id ?? '');
  const remove = useDeleteFuelEntry(vin, original?.id ?? '');
  const save = original ? update : add;
  const maxDate = useMemo(() => maxEventDate(new Date()), []);

  const [state, setState] = useState(initial);
  const [blurred, setBlurred] = useState<ReadonlySet<keyof FuelFormState>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [askingLarge, setAskingLarge] = useState(false);
  const [confirmedLarge, setConfirmedLarge] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sending = useRef(false);

  const isElectric = state.fuelType === 'ELECTRIC';
  const check = validateFuelForm(state, { lastKm, isElectric });
  const valid = Object.keys(check.errors).length === 0;
  const choice = fuelTypeChoice(vehicleFuel);
  const computed = state.touched.length === 2 ? AMOUNTS.find((a) => !state.touched.includes(a)) : undefined;

  // Editing clears a settled server error. A request in flight is never reset: that would detach its callbacks.
  const change = (next: (s: FuelFormState) => FuelFormState) => {
    if (save.isError) save.reset();
    setState(next);
  };
  const set = <K extends keyof FuelFormState>(key: K) => (value: FuelFormState[K]) => change((s) => ({ ...s, [key]: value }));
  const amount = (field: AmountField) => (raw: string) => change((s) => editAmount(s, field, raw));
  const blur = (key: keyof FuelFormState) => () => setBlurred((b) => new Set(b).add(key));
  const fieldError = (key: keyof FuelFormState): string | undefined => {
    const code = blurred.has(key) ? check.errors[key] : undefined;
    return code === 'required' ? f.required : code === 'invalid' ? f.invalid : undefined;
  };

  const send = () => {
    if (sending.current) return;
    sending.current = true;
    save.mutate(toFuelEntryRequest(state), {
      onSuccess: (saved) => {
        const consumption = saved.consumption ?? null;
        toast(consumption === null ? f.saved : f.savedWithConsumption(formatConsumption(consumption, saved.fuelType, locale)));
        back();
      },
      onError: () => {
        sending.current = false;
      },
    });
  };
  const submit = () => {
    if (!valid || !online) return;
    if (check.confirmLargeQuantity && confirmedLarge !== state.quantity) return setAskingLarge(true);
    send();
  };
  const confirmLarge = () => {
    setConfirmedLarge(state.quantity);
    setAskingLarge(false);
    send();
  };
  const confirmDelete = () => {
    setDeleting(false);
    if (remove.isPending) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        toast(f.deleted);
        back();
      },
      onError: (error) => toast(errorMessage(error)),
    });
  };

  const odometerRefused = isApiError(save.error, 'odometer-inconsistent');
  const saveProblem = !save.isError || odometerRefused
    ? null
    : isApiError(save.error, 'invalid-fuel-entry')
      ? f.invalidEntry
      : isApiError(save.error, 'fuel-entry-not-found')
        ? f.notFound
        : errorMessage(save.error);
  const unitLabel = isElectric ? f.quantityKwh : f.quantityLitres;
  const priceLabel = isElectric ? f.priceKwh : f.priceLitre;
  const helperFor = (field: AmountField) => (computed === field && state[field] !== '' ? f.computed : undefined);

  return (
    <Screen
      scroll
      header={
        <AppBar
          onBack={back}
          title={original ? en.fuelLog.edit : en.fuelLog.add}
          right={<DateChip date={state.date} today={today} onPress={() => setExpanded(true)} />}
        />
      }
      footer={
        <ActionBar
          primary={{ title: f.save, onPress: submit, loading: save.isPending, disabled: !valid || !online }}
          quiet={original ? { title: f.delete, danger: true, onPress: () => setDeleting(true), disabled: !online || remove.isPending } : undefined}
        />
      }
    >
      {choice.options.length > 1 ? (
        <ChipGroup
          label={f.fuelType}
          options={choice.options}
          value={state.fuelType}
          labelOf={(t: FuelEntryType) => en.fuelLog.type[t]}
          // A fuel is always chosen once picked: tapping the chosen one keeps it.
          onChange={(t) => set('fuelType')(t ?? state.fuelType)}
        />
      ) : null}
      <Field
        label={f.odometer}
        value={state.odometerKm}
        onChangeText={set('odometerKm')}
        onBlur={blur('odometerKm')}
        keyboardType="number-pad"
        maxLength={9}
        autoFocus={original === null}
        error={odometerRefused ? f.odometerInconsistent : fieldError('odometerKm')}
        helper={check.hints.odometer && lastKm !== null ? f.belowLast(formatKm(lastKm)) : undefined}
      />
      <Field
        label={unitLabel}
        value={state.quantity}
        onChangeText={amount('quantity')}
        onBlur={blur('quantity')}
        keyboardType="decimal-pad"
        error={fieldError('quantity')}
        helper={helperFor('quantity')}
      />
      <Field
        label={f.totalIn(state.currency)}
        value={state.total}
        onChangeText={amount('total')}
        onBlur={blur('total')}
        keyboardType="decimal-pad"
        error={fieldError('total')}
        helper={helperFor('total')}
      />
      <Field label={priceLabel} value={state.unitPrice} onChangeText={amount('unitPrice')} keyboardType="decimal-pad" helper={helperFor('unitPrice')} />
      <View>
        <Switch label={f.fullTank} value={state.fullTank} onValueChange={set('fullTank')} />
        {state.fullTank ? null : (
          <Text variant="caption" color="ink-muted">
            {f.partialCaption}
          </Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={f.moreDetails}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((now) => !now)}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: tokens.space['space-2'] }}
      >
        <Icon name={expanded ? 'down' : 'chevron'} size={18} color="ink-muted" />
        <Text variant="label">{f.moreDetails}</Text>
      </Pressable>
      {expanded ? (
        <>
          <DateField
            label={f.date}
            accessibilityLabel={f.chooseDate(state.date)}
            testID="fuel-date-picker"
            value={state.date}
            maxDate={maxDate}
            onChange={set('date')}
          />
          {isElectric ? (
            <ChipGroup label={en.fuelLog.charge.label} options={CHARGES} value={state.chargeType} labelOf={(c) => en.fuelLog.charge[c]} onChange={set('chargeType')} />
          ) : (
            <ChipGroup label={en.fuelLog.grade.label} options={GRADES} value={state.grade} labelOf={(g) => en.fuelLog.grade[g]} onChange={set('grade')} />
          )}
          <Field
            label={f.currency}
            value={state.currency}
            onChangeText={(value) => set('currency')(value.toUpperCase())}
            onBlur={blur('currency')}
            autoCapitalize="characters"
            maxLength={3}
            error={fieldError('currency')}
          />
          <Field label={f.station} value={state.station} onChangeText={set('station')} maxLength={60} />
          <Field label={f.note} value={state.note} onChangeText={set('note')} multiline maxLength={200} />
          <View>
            <Switch label={f.missed} value={state.missedPrevious} onValueChange={set('missedPrevious')} />
            <Text variant="caption" color="ink-muted">
              {f.missedHelp}
            </Text>
          </View>
        </>
      ) : null}

      {saveProblem ? (
        <Text color="danger" accessibilityRole="alert">
          {saveProblem}
        </Text>
      ) : null}

      <ConfirmSheet
        visible={askingLarge}
        title={f.largeTitle}
        body={f.largeBody(`${state.quantity} ${isElectric ? 'kWh' : 'L'}`)}
        confirmLabel={f.largeConfirm}
        dismissLabel={f.largeBack}
        onConfirm={confirmLarge}
        onCancel={() => setAskingLarge(false)}
      />
      <ConfirmSheet
        visible={deleting}
        title={f.deleteTitle}
        body={f.deleteBody}
        confirmLabel={f.deleteConfirm}
        dismissLabel={f.deleteKeep}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(false)}
      />
    </Screen>
  );
}

type Props = {
  vin: string;
  /** Edits this fill-up; without, adds one. */
  entryId?: string;
  /** The car's fuel; undefined while the car loads. */
  vehicleFuel: VehicleFuel | undefined;
  vehicleFailed: boolean;
  onRetryVehicle(): void;
};

/**
 * Adds a fill-up, or with `entryId` edits one. A new one starts from the last known km and the last entry's currency and
 * station; an edited one is found in the loaded history (there is no single-entry read), paging on until it turns up.
 */
export function FuelFormScreen({ vin, entryId, vehicleFuel, vehicleFailed, onRetryVehicle }: Props) {
  const back = useBack(`/vehicles/${vin}/fuel` as never);
  const stats = useFuelStats(vin, 'all');
  const entries = useFuelEntries(vin);
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const original = entryId === undefined ? undefined : entries.data?.find((e) => e.id === entryId);
  const searching = entryId !== undefined && original === undefined && entries.hasNextPage && !entries.isFetchingNextPage;
  const { fetchNextPage } = entries;
  useEffect(() => {
    if (searching) void fetchNextPage();
  }, [searching, fetchNextPage]);

  let body: React.ReactElement;
  if (vehicleFuel !== undefined && entryId === undefined && settled(stats) && settled(entries)) {
    const initial = initialForm({ vehicleFuel, lastEntry: entries.data?.[0] ?? null, lastKm: stats.data?.lastOdometerKm ?? null, today });
    return <Form vin={vin} vehicleFuel={vehicleFuel} initial={initial} original={null} lastKm={stats.data?.lastOdometerKm ?? null} today={today} />;
  }
  if (vehicleFuel !== undefined && original) {
    // The last known km counts this very entry, so it says nothing about the edited reading.
    return <Form vin={vin} vehicleFuel={vehicleFuel} initial={formOfEntry(original)} original={original} lastKm={null} today={today} />;
  }
  if (vehicleFuel === undefined && vehicleFailed) {
    body = <ErrorState onRetry={onRetryVehicle} />;
  } else if (entryId !== undefined && entries.data && !entries.hasNextPage) {
    body = <Text accessibilityRole="alert">{f.notFound}</Text>;
  } else if (entries.isError && !entries.data) {
    body = <ErrorState title={en.fuelLog.loadError} onRetry={() => void entries.refetch()} />;
  } else {
    body = (
      <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-4'] }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
      </View>
    );
  }
  return <Screen header={<AppBar onBack={back} title={entryId === undefined ? en.fuelLog.add : en.fuelLog.edit} />}>{body}</Screen>;
}
