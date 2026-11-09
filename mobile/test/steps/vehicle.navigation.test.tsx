import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { aClaim, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
});

const seed = (api: Parameters<NonNullable<Parameters<typeof openApp>[1]>['seed'] & object>[0]) => {
  api.state.vehicles.push(aVehicle());
  api.state.claims[SAMPLE_VIN] = [aClaim()];
};

// Those screens arrive in later tasks; stand-ins let the router resolve the pushed path.
const stub = () => null;
const laterRoutes = { 'vehicles/[vin]/events/new': stub, 'vehicles/[vin]/passports/new': stub, 'scans/new': stub };

test.each([
  [en.vehicle.addEvent, `/vehicles/${SAMPLE_VIN}/events/new`],
  [en.vehicle.scanInvoice, '/scans/new'],
  [en.vehicle.createPassport, `/vehicles/${SAMPLE_VIN}/passports/new`],
])('the %s action opens %s', async (action, pathname) => {
  await openApp(`/vehicles/${SAMPLE_VIN}`, { seed, routes: laterRoutes });
  await fireEvent.press(await screen.findByRole('button', { name: action }));
  await waitFor(() => expect(screen).toHavePathname(pathname));
});

test('approving from the claims screen leaves no departed-car screen to go back to', async () => {
  await openApp('/', { seed });
  await fireEvent.press(await screen.findByRole('button', { name: 'Volkswagen Golf' }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.reviewClaims }));
  await fireEvent.press(await screen.findByRole('button', { name: en.claims.approve }));
  await fireEvent.press(screen.getByRole('button', { name: en.claims.approveConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(router.canGoBack()).toBe(false);
});

test('giving up a car from its detail leaves nothing to go back to', async () => {
  await openApp('/', { seed });
  await fireEvent.press(await screen.findByRole('button', { name: 'Volkswagen Golf' }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(screen.getByRole('button', { name: en.vehicle.releaseConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(router.canGoBack()).toBe(false);
});
