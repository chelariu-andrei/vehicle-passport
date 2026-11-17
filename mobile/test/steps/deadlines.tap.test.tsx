import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { act, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

/* A tap on a delivered notification, as `expo-notifications` reports it. */
let tapCount = 0;
const tap = (data: unknown) =>
  ({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', notification: { request: { identifier: `n-${++tapCount}`, content: { data } } } }) as never;

const mocked = jest.mocked(Notifications);
let listeners: ((response: Notifications.NotificationResponse) => void)[] = [];
const deliver = (response: Notifications.NotificationResponse) => act(async () => listeners.forEach((l) => l(response)));

const inert = () => null;
const quietTabs = { '(tabs)/index': inert, '(tabs)/scans': inert, '(tabs)/passports': inert };
const seed = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
};
const deadlinesUrl = `/vehicles/${SAMPLE_VIN}/deadlines`;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  listeners = [];
  mocked.getLastNotificationResponse.mockReturnValue(null);
  mocked.addNotificationResponseReceivedListener.mockImplementation((listener) => {
    listeners.push(listener);
    return { remove: () => void (listeners = listeners.filter((l) => l !== listener)) };
  });
});

it('a tap while signed in opens the car’s document status', async () => {
  await openApp('/', { seed, routes: quietTabs });
  await waitFor(() => expect(listeners).toHaveLength(1));

  await deliver(tap({ vin: SAMPLE_VIN, kind: 'RCA' }));

  await waitFor(() => expect(screen).toHavePathname(deadlinesUrl));
  expect(await screen.findByText(en.deadlines.title)).toBeTruthy();
});

it('a tap that started the app opens the car’s document status', async () => {
  mocked.getLastNotificationResponse.mockReturnValue(tap({ vin: SAMPLE_VIN, kind: 'TIRE_WINTER' }));
  await openApp('/', { seed, routes: quietTabs });

  await waitFor(() => expect(screen).toHavePathname(deadlinesUrl));
});

it('a malformed payload does nothing', async () => {
  await openApp('/', { seed, routes: quietTabs });
  await waitFor(() => expect(listeners).toHaveLength(1));

  await deliver(tap({ vin: 42 }));
  await deliver(tap(null));

  expect(screen).toHavePathname('/');
});

it('a tap while signed out ends on sign-in, like any other link', async () => {
  await openApp('/', { as: null, seed, routes: quietTabs });
  await waitFor(() => expect(screen).toHavePathname('/sign-in'));
  await waitFor(() => expect(listeners).toHaveLength(1));

  await deliver(tap({ vin: SAMPLE_VIN, kind: 'RCA' }));

  await act(async () => undefined);
  expect(screen).toHavePathname('/sign-in');
});

it('a tap for a car no longer in the garage gets the app’s usual "car gone" handling', async () => {
  await openApp('/', { routes: quietTabs });
  await waitFor(() => expect(listeners).toHaveLength(1));

  await deliver(tap({ vin: SAMPLE_VIN, kind: 'RCA' }));

  expect(await screen.findByText(en.vehicle.gone)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
});
