import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatLocalDate } from '@/features/event';
import { useRefetchOnFocus } from '@/shared/api';
import { AppBar, Button, EmptyState, ErrorState, FilterChip, Icon, Screen, Skeleton, Text, tokens } from '@/shared/design';
import { useLocale } from '@/shared/i18n';
import { en } from '@/shared/i18n/en';

import { useFuelEntries } from '../api/useFuelEntries';
import { useFuelStats, type FuelPeriod, type FuelStats } from '../api/useFuelStats';
import { consumptionSeries, monthlyBars, priceSeries } from '../model/chartData';
import { formatConsumption, formatKm, formatMoney, formatRate, unitOf } from '../model/fuelDisplay';
import type { FuelEntryType } from '../model/fuelForm';
import { AlertCard } from './AlertCard';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { FuelRow } from './FuelRow';
import { GradeComparisonCard } from './GradeComparisonCard';
import { StatTile } from './StatTile';

const s = en.fuelLog.stats;
const PERIODS: FuelPeriod[] = ['3m', '6m', '12m', 'all'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: tokens.space['space-2'] }}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Tiles, alert, charts and grade card for one fuel type of the period's statistics. */
function Summary({ stats, fuelType, currency, period, locale }: { stats: FuelStats; fuelType: FuelEntryType | null; currency: string; period: FuelPeriod; locale: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const today = useMemo(() => formatLocalDate(new Date()), []);
  const current = stats.byFuelType.find((t) => t.fuelType === fuelType) ?? stats.byFuelType[0];
  const type: FuelEntryType = current?.fuelType ?? 'PETROL';
  const unit = unitOf(type);
  const consumption = (v: number | null | undefined) => formatConsumption(v ?? null, type, locale);
  const money = (v: number) => formatMoney(v, currency, locale);
  const alert = current?.alert ?? null;

  // The chart's points in its own order, so a tapped dot can say its km.
  const closing = (current?.points ?? [])
    .filter((p) => p.consumption !== null && p.consumption !== undefined)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const series = consumptionSeries(current?.points ?? [], alert?.entryId ?? null);
  const prices = priceSeries(current?.points ?? []);
  const bars = monthlyBars(stats.monthly, period, today);
  const pickedPoint = picked === null ? undefined : closing[picked];
  const lastPrice = prices.length > 0 ? prices[prices.length - 1].y : null;

  return (
    <>
      {alert ? (
        <AlertCard
          deltaPct={alert.deltaPct}
          latest={consumption(alert.latest)}
          baseline={consumption(alert.baseline)}
          onPress={() => {
            const flagged = series.findIndex((p) => p.flagged);
            if (flagged >= 0) setPicked(flagged);
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-3'] }}>
        <StatTile value={consumption(current?.avgConsumption)} label={s.consumption} caption={current?.avgConsumption == null ? s.needsTanks : undefined} />
        <StatTile value={formatRate(stats.costPerKm ?? null, currency, 'km', locale)} label={s.costPerKm} caption={stats.costPerKm == null ? s.needsEntries : undefined} />
        <StatTile value={money(stats.monthEstimate.spentSoFar)} label={s.thisMonth} />
        <StatTile value={formatRate(current?.avgUnitPrice ?? null, currency, unit, locale)} label={s.avgPrice} />
      </View>
      {stats.monthEstimate.projected != null ? (
        <Text color="ink-muted">{s.monthEstimate(money(stats.monthEstimate.spentSoFar), money(stats.monthEstimate.projected))}</Text>
      ) : null}

      <Section title={s.chartConsumption}>
        {series.length < 2 ? (
          <Text color="ink-muted">{s.chartConsumptionEmpty}</Text>
        ) : (
          <View testID="consumption-chart">
            <LineChart
              series={series}
              ariaSummary={s.chartSummary(s.chartConsumption, s.summary(consumption(current?.avgConsumption), consumption(current?.lastConsumption)))}
              onPointPress={setPicked}
            />
            {pickedPoint ? (
              <Text variant="caption" color="ink-muted">
                {s.pointDetail(pickedPoint.date, consumption(pickedPoint.consumption), formatKm(pickedPoint.odometerKm))}
              </Text>
            ) : null}
          </View>
        )}
      </Section>
      {bars.length > 0 ? (
        <Section title={s.chartMonthly}>
          <View testID="monthly-chart">
            <BarChart bars={bars} ariaSummary={s.monthlySummary(money(bars[bars.length - 1].value))} />
          </View>
        </Section>
      ) : null}
      {prices.length >= 2 ? (
        <Section title={s.chartPrice}>
          <View testID="price-chart">
            <LineChart
              series={prices}
              ariaSummary={s.chartSummary(
                s.chartPrice,
                s.summary(formatRate(current?.avgUnitPrice ?? null, currency, unit, locale), formatRate(lastPrice, currency, unit, locale)),
              )}
            />
          </View>
        </Section>
      ) : null}
      {current && current.gradeComparison.length > 0 ? <GradeComparisonCard rows={current.gradeComparison} format={(v) => consumption(v)} /> : null}
    </>
  );
}

/** The fuel statistics and history of one car. */
export function FuelScreen({ vin }: { vin: string }) {
  const router = useRouter();
  const { locale } = useLocale();
  const [period, setPeriod] = useState<FuelPeriod>('6m');
  const [fuelType, setFuelType] = useState<FuelEntryType | null>(null);
  const stats = useFuelStats(vin, period);
  const entries = useFuelEntries(vin);
  useRefetchOnFocus(stats.refetch);
  useRefetchOnFocus(entries.refetch);

  const add = () => router.push(`/vehicles/${vin}/fuel/new` as never);
  const header = (
    <AppBar
      onBack={() => router.back()}
      title={en.fuelLog.title}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en.fuelLog.add}
          onPress={add}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="plus" />
        </Pressable>
      }
    />
  );

  if (stats.isError && !stats.data) {
    return (
      <Screen header={header}>
        <ErrorState
          title={en.fuelLog.loadError}
          onRetry={() => {
            void stats.refetch();
            if (entries.isError) void entries.refetch();
          }}
        />
      </Screen>
    );
  }
  if (stats.isPending || entries.isPending) {
    return (
      <Screen header={header}>
        <View accessible accessibilityLabel={en.common.loading} style={{ gap: tokens.space['space-3'] }}>
          <Skeleton height={36} width="70%" />
          <Skeleton height={96} />
          <Skeleton height={96} />
          <Skeleton height={160} />
        </View>
      </Screen>
    );
  }
  const list = entries.data ?? [];
  if (list.length === 0 && stats.data.entryCount === 0) {
    return (
      <Screen header={header}>
        <EmptyState icon="fuel" title={en.fuelLog.empty.title} body={en.fuelLog.empty.body} action={{ title: en.fuelLog.add, onPress: add }} />
      </Screen>
    );
  }

  const types = stats.data.byFuelType;
  const shownType = types.find((t) => t.fuelType === fuelType)?.fuelType ?? types[0]?.fuelType ?? null;
  const currency = stats.data.currency ?? list[0]?.currency ?? 'RON';

  return (
    <Screen scroll header={header}>
      <View accessibilityLabel={s.periods} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
        {PERIODS.map((p) => (
          <FilterChip key={p} label={en.fuelLog.periods[p]} active={p === period} onPress={() => setPeriod(p)} />
        ))}
      </View>
      {types.length > 1 ? (
        <View accessibilityLabel={s.fuelTypes} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space['space-2'] }}>
          {types.map((t) => (
            <FilterChip key={t.fuelType} label={en.fuelLog.type[t.fuelType]} active={t.fuelType === shownType} onPress={() => setFuelType(t.fuelType)} />
          ))}
        </View>
      ) : null}
      {/* Keyed so a tapped point does not carry over to another fuel or period. */}
      <Summary key={`${period}:${shownType}`} stats={stats.data} fuelType={shownType} currency={currency} period={period} locale={locale} />

      <Section title={s.history}>
        {entries.isError && list.length === 0 ? (
          <ErrorState title={en.fuelLog.loadError} onRetry={() => void entries.refetch()} />
        ) : list.length === 0 ? (
          <Text color="ink-muted">{s.historyEmpty}</Text>
        ) : (
          list.map((entry) => (
            <FuelRow key={entry.id} entry={entry} locale={locale} onPress={() => router.push(`/vehicles/${vin}/fuel/${entry.id}` as never)} />
          ))
        )}
        {entries.hasNextPage ? (
          <Button kind="secondary" title={s.more} loading={entries.isFetchingNextPage} onPress={() => void entries.fetchNextPage()} />
        ) : null}
      </Section>
    </Screen>
  );
}
