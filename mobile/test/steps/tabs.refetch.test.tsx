import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';

import { aVehicle } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
});

/* A car can leave the account from another device while this app sits on the Scans or Passports tab. */
it.each(['/passports', '/scans'])('the %s tab reloads the garage when it regains focus', async (url) => {
  const away = url === '/passports' ? '/scans' : '/passports';
  const fake = await openApp(url, {
    seed: (api) => api.state.vehicles.push(aVehicle(), aVehicle({ vin: 'UU1HSDAN123456789', make: 'Dacia', model: 'Duster' })),
  });
  await screen.findByText('Volkswagen Golf');
  const before = fake.callsTo('listMyVehicles').length;
  await act(async () => router.navigate(away));
  await act(async () => router.navigate(url));
  await waitFor(() => expect(fake.callsTo('listMyVehicles').length).toBeGreaterThan(before));
});
