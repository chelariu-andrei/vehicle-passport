import { consumptionSeries, monthlyBars, priceSeries, type StatsPoint } from './chartData';

const point = (n: number, o: Partial<StatsPoint> = {}): StatsPoint => ({
  entryId: `e${n}`,
  date: `2026-10-${String(n).padStart(2, '0')}`,
  odometerKm: 10_000 + n * 100,
  unitPrice: 7 + n / 10,
  consumption: null,
  ...o,
});

describe('consumptionSeries', () => {
  test('an empty list and a list with no consumption give nothing', () => {
    expect(consumptionSeries([], null)).toEqual([]);
    expect(consumptionSeries([point(1), point(2)], null)).toEqual([]);
  });

  test('only points with a consumption value are kept, in date order', () => {
    const series = consumptionSeries([point(1), point(2, { consumption: 6.8 }), point(3, { consumption: 7.1 })], null);
    expect(series.map((p) => p.y)).toEqual([6.8, 7.1]);
    expect(series[0].x).toBeLessThan(series[1].x);
    expect(series.every((p) => !p.flagged)).toBe(true);
  });

  test('a single point is a series of one without throwing', () => {
    expect(consumptionSeries([point(2, { consumption: 6.8 })], null)).toHaveLength(1);
  });

  test('the alert point is flagged', () => {
    const series = consumptionSeries([point(1, { consumption: 6.8 }), point(2, { consumption: 8.4 })], 'e2');
    expect(series.map((p) => p.flagged)).toEqual([false, true]);
  });
});

describe('priceSeries', () => {
  test('every entry is a point', () => {
    const series = priceSeries([point(1), point(2)]);
    expect(series.map((p) => p.y)).toEqual([7.1, 7.2]);
    expect(priceSeries([])).toEqual([]);
  });
});

describe('monthlyBars', () => {
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].map((month, i) => ({
    month,
    cost: 100 + i,
    quantity: 10,
    entries: 2,
    distanceKm: null,
  }));

  test('the current month is partial, earlier ones are not', () => {
    const bars = monthlyBars(months, '12m', '2026-11-17');
    expect(bars.at(-1)).toMatchObject({ value: 106, partial: true });
    expect(bars.slice(0, -1).every((b) => !b.partial)).toBe(true);
  });

  test('the period limits how many months show', () => {
    expect(monthlyBars(months, '3m', '2026-11-17')).toHaveLength(3);
    expect(monthlyBars(months, '6m', '2026-11-17')).toHaveLength(6);
    expect(monthlyBars(months, 'all', '2026-11-17')).toHaveLength(7);
  });

  test('no months gives no bars', () => {
    expect(monthlyBars([], '6m', '2026-11-17')).toEqual([]);
  });
});
