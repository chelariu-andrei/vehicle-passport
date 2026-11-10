import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { aVehicle } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('confirming gives the car up, returns to the garage and does not say the car was taken away', async () => {
  const fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.releaseConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(fake.callsTo('releaseVehicle')).toHaveLength(1);
  expect(fake.state.vehicles).toHaveLength(0);
  expect(screen.queryByText(en.vehicle.gone)).toBeNull();
});

test('cancelling the warning sends nothing', async () => {
  const fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.releaseKeep }));

  await waitFor(() => expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull());
  expect(fake.callsTo('releaseVehicle')).toHaveLength(0);
  expect(screen).toHavePathname('/');
});

test('the confirmation is presented only after the menu has closed, and once', async () => {
  const fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));

  // Two modals must never be on screen in the same tick: iOS can drop the second one.
  expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull();
  expect(await screen.findByText(en.vehicle.releaseBody)).toBeTruthy();
  expect(screen.getAllByText(en.vehicle.releaseTitle)).toHaveLength(1);
  expect(screen.queryByRole('button', { name: en.vehicle.edit })).toBeNull();
  expect(fake.callsTo('releaseVehicle')).toHaveLength(0);
});
