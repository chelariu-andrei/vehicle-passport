import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { claimStore } from '@/features/vehicle';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import type { FakeApi } from '../fake-api';
import { aClaim, aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/garage.feature', { loadRelativePath: true });

const OTHER_VIN = 'WBAZZZ1JZXW000002';

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => {
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});

const me = () => fakeAuth.userId!;
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

/** Every host element type in a rendered tree. */
function hostTypes(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(hostTypes);
  if (typeof node !== 'object' || node === null) return [];
  const { type, children } = node as { type: string; children: unknown };
  return [type, ...hostTypes(children)];
}

/** Opens the Add vehicle sheet from the garage and submits a valid form for `vin`. */
async function registerVin(vin: string) {
  await press(en.garage.addVehicle);
  await fireEvent.changeText(await screen.findByLabelText(en.vehicleForm.vin), vin.toLowerCase());
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.make), 'Volkswagen');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), 'Golf');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.year), '2015');
  await fireEvent.press(screen.getByRole('radio', { name: en.fuel.DIESEL }));
  await press(en.vehicleForm.submit);
}

/** The app comes back to the foreground: stale queries refetch. */
async function returnToApp() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

async function openGarageWithClaim(claimId = aClaim().claimId) {
  const fake = await openApp('/', {
    seed: (seeded) => {
      seeded.state.claims[OTHER_VIN] = [{ claimId, filedAt: '2025-01-15T10:00:00Z' }];
    },
  });
  await claimStore.upsert(me(), { claimId, vin: OTHER_VIN, filedAt: '2025-01-15T10:00:00Z' });
  // The garage may already have read the (empty) store; a pull to refresh is how the user would see the row.
  await returnToApp();
  expect(await screen.findByText(en.garage.waiting)).toBeTruthy();
  return { fake, claimId };
}

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let claimId = '';

  test('A VIN with an active owner files a claim', ({ when, then, and }) => {
    when('I register a VIN and the API answers 202', async () => {
      fake = await openApp('/', { seed: (seeded) => seeded.state.otherOwnerVins.add(OTHER_VIN) });
      expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
      await registerVin(OTHER_VIN);
      expect(await screen.findByText(en.vehicleForm.filedBody)).toBeTruthy();
      await press(en.vehicleForm.done);
    });
    then('no vehicle is added to my garage', async () => {
      expect(fake.state.vehicles).toHaveLength(0);
      expect(await screen.findByText(en.garage.waiting)).toBeTruthy();
      expect(screen.queryByText(en.garage.noEntries)).toBeNull();
    });
    and('I see a pending claim row for that VIN', () => {
      expect(screen.getByText(OTHER_VIN)).toBeTruthy();
      expect(screen.getByRole('button', { name: en.garage.withdraw })).toBeTruthy();
    });
  });

  test('An approved claim resolves itself', ({ given, when, then }) => {
    given('I have a pending claim row for a VIN', async () => {
      ({ fake } = await openGarageWithClaim());
    });
    when('my garage list contains that VIN', async () => {
      fake.state.vehicles.push(aVehicle({ vin: OTHER_VIN }));
      await returnToApp();
    });
    then('the claim row is gone and the vehicle is shown', async () => {
      expect(await screen.findByText('Volkswagen Golf')).toBeTruthy();
      await waitFor(() => expect(screen.queryByText(en.garage.waiting)).toBeNull());
      expect(await claimStore.list(me())).toEqual([]);
    });
  });

  test('The odometer comes from the latest entry', ({ given, when, then }) => {
    given('a car with entries at 100 km, confirmed and 200 km, documented', async () => {
      fake = await openApp('/', {
        seed: (seeded) => {
          seeded.state.vehicles.push(aVehicle());
          seeded.state.events[SAMPLE_VIN] = [
            anEvent({ date: '2024-06-01', odometerKm: 200, evidence: 'DOCUMENTED' }),
            anEvent({ date: '2024-01-01', odometerKm: 100, evidence: 'USER_CONFIRMED' }),
          ];
        },
      });
    });
    when('I open the garage', async () => {
      expect(await screen.findByText(SAMPLE_VIN)).toBeTruthy();
    });
    then(/^its card shows "(.*)" with evidence "(.*)"$/, async (odometer: string, evidence: string) => {
      expect(await screen.findByText(odometer)).toBeTruthy();
      expect(screen.getByLabelText(en.evidence.a11y(evidence))).toBeTruthy();
      expect(screen.queryByLabelText(en.evidence.a11y('confirmed'))).toBeNull();
    });
  });

  test('A car with no history', ({ given, then }) => {
    given('a car with no entries', async () => {
      fake = await openApp('/', { seed: (seeded) => seeded.state.vehicles.push(aVehicle()) });
    });
    then(/^its card shows "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
    });
  });

  test('Empty garage', ({ given, then }) => {
    given('I have no cars', async () => {
      fake = await openApp('/');
    });
    then(/^I see "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.getByRole('button', { name: en.garage.addVehicle })).toBeTruthy();
    });
  });

  test('The garage never runs a live 3D stage', ({ given, when, then }) => {
    given('I have two cars', async () => {
      fake = await openApp('/', {
        seed: (seeded) => seeded.state.vehicles.push(aVehicle(), aVehicle({ vin: OTHER_VIN, model: 'Polo' })),
      });
    });
    when('I open the garage', async () => {
      expect(await screen.findByText(SAMPLE_VIN)).toBeTruthy();
      expect(await screen.findByText(OTHER_VIN)).toBeTruthy();
    });
    then('no WebView is mounted', async () => {
      await waitFor(() => expect(screen.getAllByText(en.garage.noEntries)).toHaveLength(2));
      expect(screen.getAllByTestId('stage-placeholder')).toHaveLength(2);
      expect(hostTypes(screen.toJSON())).not.toContain('WebView');
    });
  });

  test('Filing the same claim twice shows one row', ({ given, when, then }) => {
    given('I have a pending claim row for a VIN', async () => {
      claimId = aClaim().claimId;
      ({ fake } = await openGarageWithClaim(claimId));
    });
    when('I register that VIN and the API answers 202 with the same claim id', async () => {
      fake.state.otherOwnerVins.add(OTHER_VIN);
      // The fake issues claim ids with randomUUID; this makes it answer with the one already filed.
      jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(claimId as ReturnType<typeof crypto.randomUUID>);
      await registerVin(OTHER_VIN);
      expect(await screen.findByText(en.vehicleForm.filedBody)).toBeTruthy();
      await press(en.vehicleForm.done);
    });
    then('I see one pending claim row', async () => {
      await waitFor(() => expect(screen.getAllByText(en.garage.waiting)).toHaveLength(1));
      expect(await claimStore.list(me())).toHaveLength(1);
    });
  });

  test('Withdrawing removes the row', ({ given, when, then }) => {
    let answer = '';
    given('I have a pending claim row for a VIN', async () => {
      ({ fake, claimId } = await openGarageWithClaim());
    });
    when(/^I withdraw it and the API answers (.*)$/, async (text: string) => {
      answer = text;
      const refused = /^(\d{3}) "(.*)"$/.exec(text);
      if (refused) fake.failNext('withdrawClaim', Number(refused[1]), refused[2]);
      await press(en.garage.withdraw);
    });
    then('the row is gone', async () => {
      await waitFor(() => expect(screen.queryByText(en.garage.waiting)).toBeNull());
      expect(await claimStore.list(me())).toEqual([]);
      expect(fake.callsTo('withdrawClaim')).toHaveLength(1);
      if (answer === '204') expect(screen.queryByText(en.errors.codes['claim-not-pending'])).toBeNull();
      else expect(await screen.findByText('That claim was already decided.')).toBeTruthy();
    });
  });

  test('Already mine', ({ when, then }) => {
    when(/^I register a VIN and the API answers 409 "(.*)"$/, async (code: string) => {
      fake = await openApp('/');
      expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
      fake.failNext('registerVehicle', 409, code);
      await registerVin(SAMPLE_VIN);
    });
    then(/^I am told "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
      expect(fake.callsTo('registerVehicle')[0].body).toEqual({
        vin: SAMPLE_VIN,
        make: 'Volkswagen',
        model: 'Golf',
        year: 2015,
        fuel: 'DIESEL',
      });
    });
  });

  test('Offline garage', ({ given, when, then }) => {
    given('my garage has loaded', async () => {
      fake = await openApp('/', { seed: (seeded) => seeded.state.vehicles.push(aVehicle()) });
      expect(await screen.findByText('Volkswagen Golf')).toBeTruthy();
    });
    when('the connection drops', async () => {
      await act(async () => onlineManager.setOnline(false));
    });
    then('I see the offline banner and my car is still shown', () => {
      expect(screen.getByText(en.errors.offlineBanner)).toBeTruthy();
      expect(screen.getByText('Volkswagen Golf')).toBeTruthy();
    });
  });
});
