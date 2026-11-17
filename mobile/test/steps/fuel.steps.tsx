import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aFuelEntry, aFuelStats, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/fuel.feature', { loadRelativePath: true });

const f = en.fuelLog.form;
const s = en.fuelLog.stats;
const fuelUrl = `/vehicles/${SAMPLE_VIN}/fuel`;

let seed: (api: FakeApi) => void = () => undefined;
let fake: FakeApi;

beforeEach(async () => {
  await AsyncStorage.clear();
  seed = () => undefined;
});

const withCar = (fuel: 'DIESEL' | 'ELECTRIC', extra?: (api: FakeApi) => void) => {
  seed = (api) => {
    api.state.vehicles.push(aVehicle({ fuel }));
    extra?.(api);
  };
};

const withStats = (alert: { latest: number; baseline: number; deltaPct: number } | null) => {
  seed = (api) => {
    api.state.vehicles.push(aVehicle({ fuel: 'DIESEL' }));
    const entryId = globalThis.crypto.randomUUID();
    api.state.fuelStats[SAMPLE_VIN] = aFuelStats({
      currency: 'RON',
      entryCount: 4,
      lastOdometerKm: 12000,
      byFuelType: [
        {
          fuelType: 'DIESEL',
          unit: 'L',
          avgConsumption: 6.9,
          lastConsumption: alert?.latest ?? 6.9,
          avgUnitPrice: 7.2,
          segmentCount: 3,
          points: [{ entryId, date: '2026-10-01', odometerKm: 12000, unitPrice: 7.2, consumption: alert?.latest ?? 6.9 }],
          alert: alert ? { ...alert, entryId } : null,
          gradeComparison: [],
        },
      ],
    });
  };
};

const type = async (label: string, value: string) => fireEvent.changeText(await screen.findByLabelText(label), value);

defineFeature(feature, (test) => {
  test('A fill-up is added from the car screen without a unit price', ({ given, when, and, then }) => {
    given('a diesel car with no fill-ups', () => withCar('DIESEL'));
    when('I open Fuel from the car screen', async () => {
      fake = await openApp('/', { seed });
      await fireEvent.press(await screen.findByRole('button', { name: en.fuelLog.carRow }));
    });
    and('I add a fill-up of 38.2 litres for 312 at 84210 km', async () => {
      const add = await screen.findAllByRole('button', { name: en.fuelLog.add });
      await fireEvent.press(add[0]);
      await type(f.odometer, '84210');
      await type(f.quantityLitres, '38.2');
      await type(f.totalIn('RON'), '312');
      await fireEvent.press(screen.getByRole('button', { name: f.save }));
    });
    then('the fill-up is saved with quantity 38.2, total 312 and no unit price', async () => {
      await waitFor(() => expect(fake.callsTo('addFuelEntry')).toHaveLength(1));
      const body = fake.callsTo('addFuelEntry')[0].body as Record<string, unknown>;
      expect(body).toMatchObject({ odometerKm: 84210, quantity: 38.2, total: 312, fuelType: 'DIESEL' });
      expect(body).not.toHaveProperty('unitPrice');
    });
  });

  test('An electric car counts energy and asks how it was charged', ({ given, when, then, and }) => {
    given('an electric car with no fill-ups', () => withCar('ELECTRIC'));
    when('I open the new fill-up form', async () => {
      await openApp(`${fuelUrl}/new`, { seed, routes: { 'vehicles/[vin]/fuel/index': () => null } });
    });
    then('I see the energy field and the charging choice', async () => {
      expect(await screen.findByLabelText(f.quantityKwh)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: f.moreDetails }));
      expect(await screen.findByText(en.fuelLog.charge.label)).toBeTruthy();
    });
    and('I do not see the fuel grade choice', () => {
      expect(screen.queryByText(en.fuelLog.grade.label)).toBeNull();
    });
  });

  test('A partial fill-up produces no consumption', ({ given, when, then }) => {
    given('a diesel car with a full tank at 10000 km and a partial fill-up at 10300 km', () =>
      withCar('DIESEL', (api) => {
        api.state.fuel[SAMPLE_VIN] = [
          aFuelEntry({ date: '2026-10-01', odometerKm: 10000, quantity: 40, total: 300, fullTank: true }),
          aFuelEntry({ date: '2026-10-10', odometerKm: 10300, quantity: 20, total: 150, fullTank: false }),
        ];
      }),
    );
    when('I open Fuel', async () => {
      await openApp(fuelUrl, { seed });
    });
    then('no consumption is shown anywhere', async () => {
      expect(await screen.findByText(s.history)).toBeTruthy();
      expect(screen.queryByText(/L\/100 km/)).toBeNull();
    });
  });

  test('The alert card appears when the server reports a sudden increase', ({ given, when, then }) => {
    given('the server reports consumption of 8.4 against 6.9 usual', () => withStats({ latest: 8.4, baseline: 6.9, deltaPct: 21.7 }));
    when('I open Fuel', async () => {
      await openApp(fuelUrl, { seed });
    });
    then('I read the alert with both numbers', async () => {
      expect(await screen.findByText(s.alertTitle('22 %'))).toBeTruthy();
      expect(screen.getByText(s.alertBody('8.4 L/100 km', '6.9 L/100 km'))).toBeTruthy();
    });
  });

  test('The Standard vs Premium comparison needs enough data', ({ given, when, then }) => {
    given('the server reports no grade comparison', () => withStats(null));
    when('I open Fuel', async () => {
      await openApp(fuelUrl, { seed });
    });
    then('I do not see the Standard vs Premium card', async () => {
      expect(await screen.findByText(s.history)).toBeTruthy();
      expect(screen.queryByText(s.gradeTitle)).toBeNull();
    });
  });
});
