import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aClaim, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp, registerVin } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/vehicle.feature', { loadRelativePath: true });

const detailUrl = `/vehicles/${SAMPLE_VIN}`;
const CAR = 'Volkswagen Golf';
const FILED = '2025-01-15T10:00:00Z';

beforeEach(async () => {
  await AsyncStorage.clear();
});

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

/** The app comes back to the foreground: stale queries refetch. */
async function returnToApp() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

const withCar = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
};
const withCarAndClaim = (api: FakeApi) => {
  withCar(api);
  api.state.claims[SAMPLE_VIN] = [aClaim({ claimId: '6f1c1b1e-7a53-4b0e-9d56-0a1f7c1c2d33', filedAt: FILED })];
};

defineFeature(feature, (test) => {
  let fake: FakeApi;

  test('A car that left the account', ({ given, when, then }) => {
    given('a vehicle is open', async () => {
      fake = await openApp(detailUrl, { seed: withCar });
      expect(await screen.findByText(CAR)).toBeTruthy();
    });
    when(/^the API answers 404 "(.*)"$/, async (code: string) => {
      fake.failNext('getVehicle', 404, code);
      await returnToApp();
    });
    then('I return to the garage and am told the car is no longer there', async () => {
      expect(await screen.findByText(en.vehicle.gone)).toBeTruthy();
      await waitFor(() => expect(screen).toHavePathname('/'));
    });
  });

  test('A newly registered car opens', ({ when, then }) => {
    when('I register a VIN and the API answers 201', async () => {
      fake = await openApp('/');
      expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
      await registerVin(SAMPLE_VIN);
    });
    then('the new vehicle is open', async () => {
      await waitFor(() => expect(screen).toHavePathname(detailUrl));
      expect(await screen.findByText(CAR)).toBeTruthy();
      expect(fake.callsTo('registerVehicle')).toHaveLength(1);
    });
  });

  test('A car I already own is one tap away', ({ when, then }) => {
    let code = '';
    when(/^I register a VIN and the API answers 409 "(.*)"$/, async (answer: string) => {
      code = answer;
      // The car is already in the garage, so the fake answers 409 "already-owner" by itself.
      fake = await openApp('/', { seed: withCar });
      expect(await screen.findByRole('button', { name: CAR })).toBeTruthy();
      await registerVin(SAMPLE_VIN);
    });
    then('I can open that vehicle from the message', async () => {
      expect(await screen.findByText(en.errors.codes[code as 'already-owner'])).toBeTruthy();
      await press(en.vehicleForm.viewCar);
      await waitFor(() => expect(screen).toHavePathname(detailUrl));
      expect(await screen.findByText(en.vehicle.illustrative)).toBeTruthy();
    });
  });

  test('Saving sends only what changed', ({ given, when, then }) => {
    given('I am editing a vehicle', async () => {
      fake = await openApp(`${detailUrl}/edit`, { seed: withCar });
      expect(await screen.findByLabelText(en.vehicleForm.model)).toBeTruthy();
    });
    when('I change the model and save', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), 'Passat');
      await press(en.vehicle.save);
    });
    then('the request contains only the model', async () => {
      await waitFor(() => expect(fake.callsTo('updateVehicle')).toHaveLength(1));
      expect(fake.callsTo('updateVehicle')[0].body).toEqual({ model: 'Passat' });
    });
  });

  test('Nothing to save', ({ given, then }) => {
    given('I am editing a vehicle', async () => {
      fake = await openApp(`${detailUrl}/edit`, { seed: withCar });
      expect(await screen.findByLabelText(en.vehicleForm.model)).toBeTruthy();
    });
    then('Save is disabled', () => {
      expect(screen.getByRole('button', { name: en.vehicle.save })).toBeDisabled();
    });
  });

  test('Giving up ownership warns first', ({ when, then, and }) => {
    when('I choose Give up ownership', async () => {
      fake = await openApp(detailUrl, { seed: withCar });
      expect(await screen.findByText(CAR)).toBeTruthy();
      await press(en.vehicle.release);
    });
    then('I am warned that access ends, unconfirmed scans are cancelled and passports stay live', () => {
      const body = en.vehicle.releaseBody;
      expect(screen.getByText(body)).toBeTruthy();
      expect(body).toMatch(/access to this car's history ends/i);
      expect(body).toMatch(/unconfirmed scans are cancelled/i);
      expect(body).toMatch(/passports .*stay live until you revoke them/i);
    });
    and('no request is sent until I confirm', () => {
      expect(fake.callsTo('releaseVehicle')).toHaveLength(0);
    });
  });

  test('Pending claims are announced', ({ given, when, then }) => {
    given('a vehicle has a pending claim', () => undefined);
    when('I open it', async () => {
      fake = await openApp(detailUrl, { seed: withCarAndClaim });
    });
    then('I see the claims banner', async () => {
      expect(await screen.findByText(en.vehicle.claimsBanner(1))).toBeTruthy();
      expect(screen.getByRole('button', { name: en.vehicle.reviewClaims })).toBeTruthy();
    });
  });

  test('Approving moves the car away', ({ given, when, then }) => {
    given('a vehicle has a pending claim', () => undefined);
    when('I approve it and confirm', async () => {
      fake = await openApp(detailUrl, { seed: withCarAndClaim });
      await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.reviewClaims }));
      await fireEvent.press(await screen.findByRole('button', { name: en.claims.approve }));
      await press(en.claims.approveConfirm);
    });
    then('I return to the garage and the car is gone', async () => {
      expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(fake.callsTo('approveClaim')).toHaveLength(1);
      expect(fake.state.vehicles).toHaveLength(0);
      // Leaving on purpose is not the car being taken away: no "no longer in your garage" notice.
      expect(screen.queryByText(en.vehicle.gone)).toBeNull();
    });
  });

  test('A claim already decided', ({ when, then, and }) => {
    when(/^I reject a claim and the API answers (\d{3}) "(.*)"$/, async (status: string, code: string) => {
      fake = await openApp(`${detailUrl}/claims`, { seed: withCarAndClaim });
      fake.failNext('rejectClaim', Number(status), code);
      await fireEvent.press(await screen.findByRole('button', { name: en.claims.reject }));
      await press(en.claims.rejectConfirm);
    });
    then(/^I am told "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
    });
    and('the claim list refreshes', async () => {
      await waitFor(() => expect(fake.callsTo('listPendingClaims').length).toBeGreaterThanOrEqual(2));
    });
  });

  test('The claimant stays anonymous', ({ given, then }) => {
    given('a vehicle has a pending claim', () => undefined);
    then('only its filing date is shown', async () => {
      fake = await openApp(`${detailUrl}/claims`, { seed: withCarAndClaim });
      expect(await screen.findByText(en.claims.filed('15 Jan 2025'))).toBeTruthy();
      expect(screen.queryByText(/6f1c1b1e/)).toBeNull();
      // One claim, so one pair of decisions and nothing identifying anyone.
      expect(screen.getAllByRole('button', { name: en.claims.approve })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: en.claims.reject })).toHaveLength(1);
    });
  });

  test('The stage never blocks the screen', ({ given, when, then }) => {
    given('the 3D stage has not loaded', () => undefined);
    when('I open a vehicle', async () => {
      fake = await openApp(detailUrl, { seed: withCar });
    });
    then('I see its name and history', async () => {
      expect(await screen.findByText(CAR)).toBeTruthy();
      expect(screen.getByRole('header', { name: en.vehicle.history })).toBeTruthy();
      expect(screen.getByTestId('stage-placeholder')).toBeTruthy();
    });
  });

  test('Colour is remembered', ({ when, then }) => {
    when(/^I choose "(.*)" and reopen the vehicle$/, async (colour: string) => {
      fake = await openApp('/', { seed: withCar });
      await fireEvent.press(await screen.findByRole('button', { name: CAR }));
      await fireEvent.press(await screen.findByRole('radio', { name: colour }));
      await waitFor(() => expect(screen.getByRole('radio', { name: colour })).toBeSelected());
      await press(en.common.back);
      await waitFor(() => expect(screen).toHavePathname('/'));
      await fireEvent.press(await screen.findByRole('button', { name: CAR }));
    });
    then(/^"(.*)" is selected$/, async (colour: string) => {
      await waitFor(() => expect(screen.getByRole('radio', { name: colour })).toBeSelected());
      expect(screen.getByRole('radio', { name: 'Obsidian' })).not.toBeSelected();
    });
  });
});
