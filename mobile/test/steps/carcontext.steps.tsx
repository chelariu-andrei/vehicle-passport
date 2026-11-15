import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager } from '@tanstack/react-query';
import { AccessibilityInfo, Platform } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { claimStore } from '@/features/vehicle';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import type { FakeApi } from '../fake-api';
import { aClaim, aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp, reopenApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/carcontext.feature', { loadRelativePath: true });

/* The live stage is a WebView. Jest has no native one, so a stub stands in and the test counts how many mount. */
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: async () => ({ localUri: 'file:///viewer.html', uri: 'file:///viewer.html' }) }),
  },
}));
jest.mock('../../assets/viewer/viewer.html', () => 1, { virtual: true });
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef(function WebViewStub(_props: never, ref: never) {
    React.useImperativeHandle(ref, () => ({ postMessage: () => undefined }));
    return React.createElement(View, { testID: 'car-webview' });
  });
  return { WebView, default: WebView };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const DUSTER_VIN = 'UU1HSDDN5K0000002';
const golf = (o = {}) => aVehicle(o);
const duster = (o = {}) => aVehicle({ vin: DUSTER_VIN, make: 'Dacia', model: 'Duster', year: 2020, fuel: 'PETROL', engine: null, ...o });
const FILED = '2025-01-15T10:00:00Z';

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** The app comes back to the foreground: stale queries refetch. */
async function returnToApp() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

/** Two cars with one history entry each, Golf first. */
const twoCars = (api: FakeApi) => {
  api.state.vehicles.push(golf(), duster());
  api.state.events[SAMPLE_VIN] = [anEvent({ details: { serviceName: 'Brake pads' } })];
  api.state.events[DUSTER_VIN] = [anEvent({ details: { serviceName: 'Timing belt' } })];
};

async function openCarList() {
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`${en.cars.switch}$`) }));
  expect(await screen.findByText(en.cars.title)).toBeTruthy();
}

async function chooseDuster() {
  await openCarList();
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^Dacia Duster, ${DUSTER_VIN}$`) }));
}

const titleIs = async (name: string) => {
  expect(await screen.findByText(name)).toBeTruthy();
  expect(screen.getAllByText(name)).toHaveLength(1);
};

defineFeature(feature, (test) => {
  let fake: FakeApi;

  test('The first car is active', ({ given, when, then, and }) => {
    given('I own a Volkswagen Golf and a Dacia Duster', () => undefined);
    when('I open the app', async () => {
      fake = await openApp('/', { seed: twoCars });
    });
    then(/^the title is "(.*)"$/, titleIs);
    and("I see the Golf's history", async () => {
      expect(await screen.findByText('Brake pads')).toBeTruthy();
    });
  });

  test('Switching car changes the home screen', ({ given, when, then, and }) => {
    let announce: jest.SpyInstance;
    given('I own a Volkswagen Golf and a Dacia Duster', () => undefined);
    when(/^I open the car list and choose "(.*)"$/, async () => {
      announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
      fake = await openApp('/', { seed: twoCars });
      await chooseDuster();
    });
    then(/^the title is "(.*)"$/, titleIs);
    and("I see the Duster's history and not the Golf's", async () => {
      expect(await screen.findByText('Timing belt')).toBeTruthy();
      expect(screen.queryByText('Brake pads')).toBeNull();
    });
    and(/^"(.*)" is announced$/, (message: string) => {
      expect(announce).toHaveBeenCalledWith(message);
      expect(message).toBe(en.cars.nowShowing('Dacia Duster'));
    });
  });

  test('The choice survives a restart', ({ given, when, then }) => {
    given('I chose the Dacia Duster', async () => {
      fake = await openApp('/', { seed: twoCars });
      await chooseDuster();
      expect(await screen.findByText('Timing belt')).toBeTruthy();
      await waitFor(async () => expect(await AsyncStorage.getItem(`activeCar:${fakeAuth.userId}`)).toBe(DUSTER_VIN));
    });
    when('I open the app again', async () => {
      await reopenApp('/');
    });
    then(/^the title is "(.*)"$/, titleIs);
  });

  test('One car has nothing to switch', ({ given, then }) => {
    given('I own one car', async () => {
      fake = await openApp('/', { seed: (api) => api.state.vehicles.push(golf()) });
    });
    then('the title is not a button', async () => {
      await titleIs('Volkswagen Golf');
      expect(screen.queryByRole('button', { name: new RegExp(en.cars.switch) })).toBeNull();
      expect(screen.queryByRole('button', { name: /Volkswagen Golf/ })).toBeNull();
    });
  });

  test('One car can still add another', ({ given, when, then }) => {
    given('I own one car', async () => {
      fake = await openApp('/', { seed: (api) => api.state.vehicles.push(golf()) });
      await titleIs('Volkswagen Golf');
    });
    when('I choose Add a car from the overflow menu', async () => {
      // Jest's iOS Modal never reports a dismissal; the menu's Android timer path stands in for it.
      jest.replaceProperty(Platform, 'OS', 'android');
      await press(en.vehicle.more);
      await press(en.cars.add);
    });
    then('onboarding step 1 opens', async () => {
      await waitFor(() => expect(screen).toHavePathname('/onboarding'));
      expect(await screen.findByText(en.journey.vinTitle)).toBeTruthy();
    });
  });

  test('The plate sits under the name, or the VIN without one', ({ given, then }) => {
    given(/^a car with plate "(.*)" and a car with no plate$/, async (plate: string) => {
      fake = await openApp('/', { seed: (api) => api.state.vehicles.push(golf({ plate }), duster()) });
      await openCarList();
    });
    then(/^the first shows "(.*)" and the second shows its VIN$/, (plate: string) => {
      const first = screen.getByRole('button', { name: `Volkswagen Golf, ${plate}` });
      const second = screen.getByRole('button', { name: `Dacia Duster, ${DUSTER_VIN}` });
      expect(within(first).getByText(plate)).toBeTruthy();
      expect(within(second).getByText(DUSTER_VIN)).toBeTruthy();
      // The active car's title carries the same line.
      expect(screen.getByRole('button', { name: `Volkswagen Golf, ${plate}. ${en.cars.switch}` })).toBeTruthy();
    });
  });

  test('The active car leaves the account', ({ given, when, then }) => {
    given('I own two cars and the active one is transferred away', async () => {
      fake = await openApp('/', { seed: twoCars });
      await titleIs('Volkswagen Golf');
      // Transferred: the server stops listing it and answers 404 "vehicle-not-found" for it.
      fake.state.vehicles = fake.state.vehicles.filter((v) => v.vin !== SAMPLE_VIN);
    });
    when('the app refetches', async () => {
      await returnToApp();
    });
    then('the other car is active and I am told the first is no longer in my garage', async () => {
      expect(await screen.findByText(en.vehicle.gone)).toBeTruthy();
      await titleIs('Dacia Duster');
      expect(await screen.findByText('Timing belt')).toBeTruthy();
      expect(screen.queryByText('Brake pads')).toBeNull();
      expect(screen).toHavePathname('/');
    });
  });

  test('A car link makes that car active', ({ when, then }) => {
    when(/^I open "(.*)"$/, async () => {
      fake = await openApp(`/vehicles/${DUSTER_VIN}`, { seed: twoCars });
    });
    then(/^the title is "(.*)"$/, async (name: string) => {
      await titleIs(name);
      await waitFor(() => expect(screen).toHavePathname('/'));
    });
  });

  test('Claims and adding a car live in the car list', ({ given, when, then }) => {
    given('I have a pending claim', async () => {
      const claimId = aClaim().claimId;
      fake = await openApp('/', {
        seed: (api) => {
          twoCars(api);
          api.state.claims['WBAZZZ1JZXW000009'] = [{ claimId, filedAt: FILED }];
        },
      });
      await claimStore.upsert(fakeAuth.userId!, { claimId, vin: 'WBAZZZ1JZXW000009', filedAt: FILED });
      await returnToApp();
    });
    when('I open the car list', async () => {
      await openCarList();
    });
    then(/^I see "(.*)" and "(.*)"$/, async (waiting: string, add: string) => {
      expect(await screen.findByText(waiting)).toBeTruthy();
      expect(screen.getByRole('button', { name: add })).toBeTruthy();
    });
  });

  test('The car list never runs a live stage', ({ given, when, then }) => {
    given('I own two cars', async () => {
      fake = await openApp('/', { seed: twoCars });
    });
    when('I open the car list', async () => {
      expect(await screen.findByText('Brake pads')).toBeTruthy();
      await openCarList();
    });
    then('exactly one WebView is mounted', async () => {
      // The list rows are silhouettes; the one live stage is the home screen's.
      await waitFor(() => expect(screen.getAllByTestId('car-webview')).toHaveLength(1));
      expect(screen.getAllByTestId('car-silhouette').length).toBeGreaterThanOrEqual(2);
    });
  });

  test('History is grouped by year, newest first', ({ given, then, and }) => {
    given('the Golf has entries in 2026 and 2024', async () => {
      fake = await openApp('/', {
        seed: (api) => {
          api.state.vehicles.push(golf());
          api.state.events[SAMPLE_VIN] = [
            anEvent({ date: '2024-06-01', odometerKm: 100, evidence: 'USER_CONFIRMED', details: { serviceName: 'Old oil' } }),
            anEvent({ date: '2026-05-02', odometerKm: 200, evidence: 'DOCUMENTED', details: { serviceName: 'New oil' } }),
          ];
        },
      });
      expect(await screen.findByText('New oil')).toBeTruthy();
    });
    then(/^I see the label "(.*)" above the label "(.*)"$/, (upper: string, lower: string) => {
      const labels = screen.getAllByRole('header').map((h) => h.props.children).filter((c) => c === upper || c === lower);
      expect(labels).toEqual([upper, lower]);
    });
    and('each entry shows its evidence level', () => {
      const rows = screen.getAllByTestId('timeline-item');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByLabelText(en.evidence.a11y(en.evidence.DOCUMENTED))).toBeTruthy();
      expect(within(rows[1]).getByLabelText(en.evidence.a11y(en.evidence.USER_CONFIRMED))).toBeTruthy();
    });
  });

  test('Empty garage', ({ given, then }) => {
    given(/^I have no cars and "(.*)" was chosen$/, async () => {
      fake = await openApp('/');
    });
    then(/^the title is "(.*)" and I see "(.*)"$/, async (title: string, empty: string) => {
      expect(await screen.findByText(title)).toBeTruthy();
      expect(screen.getByText(empty)).toBeTruthy();
      expect(screen.getByRole('button', { name: en.cars.add })).toBeTruthy();
      expect(screen.queryByRole('button', { name: new RegExp(en.cars.switch) })).toBeNull();
    });
  });
});
