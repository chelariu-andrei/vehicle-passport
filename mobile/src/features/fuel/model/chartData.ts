import type { components } from '@/shared/api/generated/schema';

export type StatsPoint = components['schemas']['FuelStatsPoint'];
export type MonthCost = components['schemas']['FuelMonthCost'];

export type ChartPoint = { x: number; y: number; label: string; flagged: boolean };
export type Bar = { label: string; value: number; partial: boolean };

const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Only fill-ups that close a consumption segment, with the alerted one flagged. */
export function consumptionSeries(points: StatsPoint[], alertEntryId: string | null): ChartPoint[] {
  return points
    .filter((p) => p.consumption !== null && p.consumption !== undefined)
    .sort((a, b) => time(a.date) - time(b.date))
    .map((p) => ({ x: time(p.date), y: p.consumption as number, label: p.date, flagged: p.entryId === alertEntryId }));
}

export function priceSeries(points: StatsPoint[]): ChartPoint[] {
  return [...points]
    .sort((a, b) => time(a.date) - time(b.date))
    .map((p) => ({ x: time(p.date), y: p.unitPrice, label: p.date, flagged: false }));
}

const MONTHS_SHOWN = { '3m': 3, '6m': 6, '12m': 12, all: Number.POSITIVE_INFINITY } as const;

/** The last months of the selected period as bars; the current month is partial because it is not over. */
export function monthlyBars(monthly: MonthCost[], period: keyof typeof MONTHS_SHOWN, today: string): Bar[] {
  const current = today.slice(0, 7);
  const sorted = [...monthly].sort((a, b) => (a.month < b.month ? -1 : 1));
  const limit = MONTHS_SHOWN[period];
  const shown = Number.isFinite(limit) ? sorted.slice(-limit) : sorted;
  return shown.map((m) => ({ label: m.month.slice(5), value: m.cost, partial: m.month === current }));
}
