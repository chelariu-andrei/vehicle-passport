import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aFuelEntry, aFuelStats, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

type TypeStats = components['schemas']['FuelTypeStats'];

const s = en.fuelLog.stats;
const url = `/vehicles/${SAMPLE_VIN}/fuel`;
const stub = () => null;
// The form has its own tests; stand-ins keep these about the screen.
const routes = { 'vehicles/[vin]/fuel/new': stub, 'vehicles/[vin]/fuel/[entryId]': stub };

const typeStats = (o: Partial<TypeStats> = {}): TypeStats => ({
  fuelType: 'DIESEL',
  unit: 'L',
  avgConsumption: 6.9,
  lastConsumption: 7.1,
  avgUnitPrice: 7.18,
  segmentCount: 3,
  points: [
    { entryId: globalThis.crypto.randomUUID(), date: '2026-08-01', odometerKm: 10000, unitPrice: 7.1, consumption: null },
    { entryId: globalThis.crypto.randomUUID(), date: '2026-09-01', odometerKm: 10600, unitPrice: 7.2, consumption: 6.8 },
    { entryId: globalThis.crypto.randomUUID(), date: '2026-10-01', odometerKm: 11200, unitPrice: 7.25, consumption: 7.1 },
  ],
  alert: null,
  gradeComparison: [],
  ...o,
});

const fullStats = (o: Parameters<typeof aFuelStats>[0] = {}) =>
  aFuelStats({
    currency: 'RON',
    entryCount: 3,
    lastOdometerKm: 11200,
    totalCost: 900,
    costPerKm: 0.52,
    monthly: [
      { month: '2026-09', cost: 300, quantity: 40, entries: 1, distanceKm: 600 },
      { month: '2026-10', cost: 412, quantity: 55, entries: 2, distanceKm: 600 },
    ],
    monthEstimate: { month: '2026-11', spentSoFar: 412, projected: 560 },
    byFuelType: [typeStats()],
    ...o,
  });

function seed(stats?: ReturnType<typeof aFuelStats>, entries = [aFuelEntry()]) {
  return (api: FakeApi) => {
    api.state.vehicles.push(aVehicle());
    api.state.fuel[SAMPLE_VIN] = entries;
    if (stats) api.state.fuelStats[SAMPLE_VIN] = stats;
  };
}

const open = (seedFn: (api: FakeApi) => void) => openApp(url, { seed: seedFn, routes });
const tile = (label: string) => screen.findByTestId(`stat-${label}`);

afterEach(() => onlineManager.setOnline(true));

test('loading shows skeletons until the data is there', async () => {
  // Offline with nothing cached, the reads wait: the skeletons stay until the connection comes back.
  onlineManager.setOnline(false);
  await open(seed(fullStats()));
  expect(await screen.findByLabelText(en.common.loading)).toBeTruthy();
  expect(screen.queryByText(s.history)).toBeNull();
  await act(async () => onlineManager.setOnline(true));
  expect(await screen.findByText(s.history)).toBeTruthy();
  expect(screen.queryByLabelText(en.common.loading)).toBeNull();
});

test('offline, the cached data stays on screen under the banner', async () => {
  await open(seed(fullStats()));
  await tile(s.consumption);
  await act(async () => onlineManager.setOnline(false));
  expect(screen.getByText(en.errors.offlineBanner)).toBeTruthy();
  expect(await tile(s.consumption)).toBeTruthy();
});

test('a car with no fill-ups shows the empty state with an Add button and no charts', async () => {
  await open(seed(undefined, []));
  expect(await screen.findByText(en.fuelLog.empty.title)).toBeTruthy();
  expect(screen.getByText(en.fuelLog.empty.body)).toBeTruthy();
  expect(screen.queryByTestId('consumption-chart')).toBeNull();
  expect(screen.queryByTestId('price-chart')).toBeNull();
  expect(screen.queryByTestId('monthly-chart')).toBeNull();
  expect(screen.queryByText(s.consumption)).toBeNull();
  const adds = screen.getAllByRole('button', { name: en.fuelLog.add });
  await fireEvent.press(adds[adds.length - 1]);
  await waitFor(() => expect(screen).toHavePathname(`${url}/new`));
});

test('one fill-up shows dashes with captions, never 0, and no consumption chart', async () => {
  await open(seed(undefined, [aFuelEntry({ date: '2026-10-01' })]));
  const consumption = await tile(s.consumption);
  expect(within(consumption).getByText('–')).toBeTruthy();
  expect(within(consumption).getByText(s.needsTanks)).toBeTruthy();
  const perKm = await tile(s.costPerKm);
  expect(within(perKm).getByText('–')).toBeTruthy();
  expect(within(perKm).getByText(s.needsEntries)).toBeTruthy();
  expect(within(consumption).queryByText(/L\/100 km/)).toBeNull();
  expect(screen.queryByTestId('consumption-chart')).toBeNull();
  expect(screen.getByText(s.chartConsumptionEmpty)).toBeTruthy();
  expect(screen.queryByText(en.fuelLog.empty.title)).toBeNull();
});

test('a full set shows the four tiles, the estimate line and the charts with their summaries', async () => {
  await open(seed(fullStats()));
  expect(within(await tile(s.consumption)).getByText('6.9 L/100 km')).toBeTruthy();
  expect(within(await tile(s.costPerKm)).getByText('0.52 RON/km')).toBeTruthy();
  expect(within(await tile(s.thisMonth)).getByText('RON 412.00')).toBeTruthy();
  expect(within(await tile(s.avgPrice)).getByText('7.18 RON/L')).toBeTruthy();
  expect(screen.getByText(s.monthEstimate('RON 412.00', 'RON 560.00'))).toBeTruthy();
  expect(screen.getByLabelText(s.chartSummary(s.chartConsumption, s.summary('6.9 L/100 km', '7.1 L/100 km')))).toBeTruthy();
  expect(screen.getByTestId('monthly-chart')).toBeTruthy();
  expect(screen.getByTestId('price-chart')).toBeTruthy();
});

test('the alert card shows both numbers when the server sends an alert', async () => {
  const stats = fullStats();
  stats.byFuelType[0].alert = { latest: 8.4, baseline: 6.9, deltaPct: 21.7, entryId: stats.byFuelType[0].points[2].entryId };
  await open(seed(stats));
  expect(await screen.findByText(s.alertTitle('22 %'))).toBeTruthy();
  expect(screen.getByText(s.alertBody('8.4 L/100 km', '6.9 L/100 km'))).toBeTruthy();
});

test('no alert, no card', async () => {
  await open(seed(fullStats()));
  await tile(s.consumption);
  expect(screen.queryByText(/Consumption is up/)).toBeNull();
});

test('no projection hides the month estimate line', async () => {
  await open(seed(fullStats({ monthEstimate: { month: '2026-11', spentSoFar: 412, projected: null } })));
  await tile(s.consumption);
  expect(screen.queryByText(/about/)).toBeNull();
});

test('two fuel types show chips that switch the content', async () => {
  const electric = typeStats({ fuelType: 'ELECTRIC', unit: 'KWH', avgConsumption: 16.5, lastConsumption: 17, avgUnitPrice: 1.2 });
  await open(seed(fullStats({ byFuelType: [typeStats({ fuelType: 'PETROL' }), electric] })));
  expect(within(await tile(s.consumption)).getByText('6.9 L/100 km')).toBeTruthy();
  const chip = screen.getByRole('button', { name: en.fuelLog.type.ELECTRIC });
  expect(screen.getByRole('button', { name: en.fuelLog.type.PETROL }).props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(chip);
  expect(within(await tile(s.consumption)).getByText('16.5 kWh/100 km')).toBeTruthy();
  expect(within(await tile(s.avgPrice)).getByText('1.20 RON/kWh')).toBeTruthy();
});

test('one fuel type shows no fuel chips', async () => {
  await open(seed(fullStats()));
  await tile(s.consumption);
  expect(screen.queryByRole('button', { name: en.fuelLog.type.DIESEL })).toBeNull();
});

test('the grade card shows only when the server compares grades', async () => {
  await open(seed(fullStats()));
  await tile(s.consumption);
  expect(screen.queryByText(s.gradeTitle)).toBeNull();
});

test('the grade card shows both grades and a neutral caption', async () => {
  const stats = fullStats({
    byFuelType: [
      typeStats({
        gradeComparison: [
          { grade: 'STANDARD', avgConsumption: 7.1, segmentCount: 4 },
          { grade: 'PREMIUM', avgConsumption: 6.8, segmentCount: 3 },
        ],
      }),
    ],
  });
  await open(seed(stats));
  expect(await screen.findByText(s.gradeTitle)).toBeTruthy();
  expect(screen.getByText(s.gradeCaption(4, 3))).toBeTruthy();
  expect(screen.getByText('6.8 L/100 km')).toBeTruthy();
});

test('an error retries', async () => {
  const fake = await open((api) => {
    seed(fullStats())(api);
    api.failNext('getFuelStats', 500, null);
  });
  const retry = await screen.findByRole('button', { name: en.common.retry });
  expect(screen.getByText(en.fuelLog.loadError)).toBeTruthy();
  await fireEvent.press(retry);
  expect(await tile(s.consumption)).toBeTruthy();
  expect(fake.callsTo('getFuelStats').length).toBeGreaterThanOrEqual(2);
});

test('6 mo is the default period and changing it refetches with the new period', async () => {
  const fake = await open(seed(fullStats()));
  await tile(s.consumption);
  expect(fake.callsTo('getFuelStats')[0].path).toContain('period=6m');
  expect(screen.getByRole('button', { name: en.fuelLog.periods['6m'] }).props.accessibilityState).toMatchObject({ selected: true });
  await fireEvent.press(screen.getByRole('button', { name: en.fuelLog.periods['12m'] }));
  await waitFor(() => expect(fake.callsTo('getFuelStats').some((c) => c.path.includes('period=12m'))).toBe(true));
  expect(await tile(s.consumption)).toBeTruthy();
});

test('history shows consumption on the closing entry only, and a tap opens the entry', async () => {
  const first = aFuelEntry({ date: '2026-09-01', odometerKm: 10000, quantity: 40, total: 300, station: 'OMV' });
  const second = aFuelEntry({ date: '2026-10-01', odometerKm: 10500, quantity: 35, total: 262.5 });
  await open(seed(undefined, [first, second]));
  const closing = await screen.findByTestId(`fuel-row-${second.id}`);
  expect(within(closing).getByText(/7\.0 L\/100 km/)).toBeTruthy();
  const opening = screen.getByTestId(`fuel-row-${first.id}`);
  expect(within(opening).queryByText(/L\/100 km/)).toBeNull();
  expect(within(opening).getByText(/OMV/)).toBeTruthy();
  await fireEvent.press(opening);
  await waitFor(() => expect(screen).toHavePathname(`${url}/${first.id}`));
});

test('the + in the bar opens the form', async () => {
  await open(seed(fullStats()));
  await tile(s.consumption);
  await fireEvent.press(screen.getByRole('button', { name: en.fuelLog.add }));
  await waitFor(() => expect(screen).toHavePathname(`${url}/new`));
});

test('history pages on with Show more', async () => {
  const entries = Array.from({ length: 31 }, (_, i) =>
    aFuelEntry({ date: `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, odometerKm: 10000 + i * 500 }),
  );
  const fake = await open(seed(fullStats(), entries));
  await fireEvent.press(await screen.findByRole('button', { name: s.more }));
  await waitFor(() => expect(fake.callsTo('listFuelEntries')).toHaveLength(2));
  expect(await screen.findByTestId(`fuel-row-${entries[0].id}`)).toBeTruthy();
});
