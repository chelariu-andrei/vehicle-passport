import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('confirming gives the car up, returns to the garage and does not say the car was taken away', async () => {
  const fake = await openApp(`/vehicles/${SAMPLE_VIN}`, { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(screen.getByRole('button', { name: en.vehicle.releaseConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(fake.callsTo('releaseVehicle')).toHaveLength(1);
  expect(fake.state.vehicles).toHaveLength(0);
  expect(screen.queryByText(en.vehicle.gone)).toBeNull();
});

test('cancelling the warning sends nothing', async () => {
  const fake = await openApp(`/vehicles/${SAMPLE_VIN}`, { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(screen.getByRole('button', { name: en.common.cancel }));

  await waitFor(() => expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull());
  expect(fake.callsTo('releaseVehicle')).toHaveLength(0);
  expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}`);
});
