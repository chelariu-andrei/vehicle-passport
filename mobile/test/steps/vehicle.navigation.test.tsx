import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { aClaim, aFuelStats, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  await AsyncStorage.clear();
});

const seed = (api: Parameters<NonNullable<Parameters<typeof openApp>[1]>['seed'] & object>[0]) => {
  api.state.vehicles.push(aVehicle());
  api.state.claims[SAMPLE_VIN] = [aClaim()];
};

// Those screens arrive in later tasks; stand-ins let the router resolve the pushed path.
const stub = () => null;
const laterRoutes = {
  'vehicles/[vin]/events/new': stub,
  'vehicles/[vin]/passports/new': stub,
  'scans/new': stub,
};

test.each([
  [en.vehicle.addEvent, `/vehicles/${SAMPLE_VIN}/events/new`],
  [en.vehicle.scanInvoice, '/scans/new'],
  [en.vehicle.createPassport, `/vehicles/${SAMPLE_VIN}/passports/new`],
])('the %s action opens %s', async (action, pathname) => {
  await openApp('/', { seed, routes: laterRoutes });
  await fireEvent.press(await screen.findByRole('button', { name: action }));
  await waitFor(() => expect(screen).toHavePathname(pathname));
});

test('approving from the claims screen leaves no departed-car screen to go back to', async () => {
  await openApp('/', { seed });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.reviewClaims }));
  await fireEvent.press(await screen.findByRole('button', { name: en.claims.approve }));
  await fireEvent.press(screen.getByRole('button', { name: en.claims.approveConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(router.canGoBack()).toBe(false);
});

test('giving up a car from its detail leaves nothing to go back to', async () => {
  // Jest's iOS Modal never reports a dismissal; the menu's Android timer path stands in for it.
  jest.replaceProperty(Platform, 'OS', 'android');
  await openApp('/', { seed });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.releaseConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(router.canGoBack()).toBe(false);
});

test('approving the active car\'s claim moves the app on to the next car, with no notice', async () => {
  await openApp('/', {
    seed: (api) => {
      seed(api);
      api.state.vehicles.push(aVehicle({ vin: 'UU1HSDDN5K0000002', make: 'Dacia', model: 'Duster' }));
    },
  });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.reviewClaims }));
  await fireEvent.press(await screen.findByRole('button', { name: en.claims.approve }));
  await fireEvent.press(screen.getByRole('button', { name: en.claims.approveConfirm }));

  expect(await screen.findByText('Dacia Duster')).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.queryByText('Volkswagen Golf')).toBeNull();
  expect(screen.queryByText(en.vehicle.gone)).toBeNull();
});

describe('the Fuel row', () => {
  const fuelRow = () => screen.findByRole('button', { name: en.fuelLog.carRow });
  const stats = aFuelStats({
    currency: 'RON',
    entryCount: 3,
    byFuelType: [
      { fuelType: 'DIESEL', unit: 'L', avgConsumption: 6.94, lastConsumption: 7, avgUnitPrice: 7.2, segmentCount: 2, points: [], alert: null, gradeComparison: [] },
    ],
  });

  test('opens the fuel screen', async () => {
    await openApp('/', { seed, routes: { 'vehicles/[vin]/fuel/index': stub } });
    await fireEvent.press(await fuelRow());
    await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/fuel`));
  });

  test('shows the average consumption once the stats are in, and nothing while they load', async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await openApp('/', {
      seed: (api) => {
        seed(api);
        api.state.fuelStats[SAMPLE_VIN] = stats;
        // The stats answer waits until the test lets it through.
        const real = globalThis.fetch;
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : String(input);
          if (url.includes('/fuel/stats')) await held;
          return real(input, init);
        }) as typeof fetch;
      },
    });
    const row = await fuelRow();
    expect(row.props.accessibilityValue?.text).toBeUndefined();
    release();
    await waitFor(async () => expect((await fuelRow()).props.accessibilityValue?.text).toBe('6.9 L/100 km'));
  });

  test('shows no subtitle when the stats fail', async () => {
    const fake = await openApp('/', {
      seed: (api) => {
        seed(api);
        api.failNext('getFuelStats', 500, null);
      },
    });
    const row = await fuelRow();
    await waitFor(() => expect(fake.callsTo('getFuelStats').length).toBeGreaterThan(0));
    expect(row.props.accessibilityValue?.text).toBeUndefined();
  });

  test('shows no subtitle before two full tanks', async () => {
    const fake = await openApp('/', { seed });
    const row = await fuelRow();
    await waitFor(() => expect(fake.callsTo('getFuelStats').length).toBeGreaterThan(0));
    expect(row.props.accessibilityValue?.text).toBeUndefined();
  });
});
