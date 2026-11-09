import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function fillForm(vin: string) {
  await fireEvent.press(screen.getByRole('button', { name: en.garage.addVehicle }));
  await fireEvent.changeText(await screen.findByLabelText(en.vehicleForm.vin), vin);
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.make), 'Volkswagen');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), 'Golf');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.year), '2015');
  await fireEvent.press(screen.getByRole('radio', { name: en.fuel.DIESEL }));
}

/** Holds every POST /vehicles until `release` is called. */
function holdRegistration() {
  const real = globalThis.fetch;
  let open = () => {};
  const sent = { count: 0 };
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method === 'POST' && new URL(request.url).pathname === '/vehicles') {
      sent.count += 1;
      await gate;
    }
    return real(request);
  }) as typeof fetch;
  return {
    sent,
    release: () => act(async () => open()),
    restore: () => {
      globalThis.fetch = real;
    },
  };
}

test('editing a field while the registration is in flight neither re-enables Submit nor loses the result', async () => {
  const fake = await openApp('/');
  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await fillForm(SAMPLE_VIN);
  const held = holdRegistration();
  try {
    await fireEvent.press(screen.getByRole('button', { name: en.vehicleForm.submit }));
    await waitFor(() => expect(screen.getByRole('button', { name: en.vehicleForm.submit })).toBeDisabled());

    await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.engine), '2.0 TDI');
    expect(screen.getByRole('button', { name: en.vehicleForm.submit })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: en.vehicleForm.submit }));
    expect(held.sent.count).toBe(1);

    await held.release();
    // The car page is a later task; the 201 path is what leaves the sheet.
    await waitFor(() => expect(screen).not.toHavePathname('/vehicles/new'));
    expect(fake.state.vehicles).toHaveLength(1);
    expect(fake.callsTo('registerVehicle')).toHaveLength(1);
  } finally {
    held.restore();
  }
});

test('editing a field after a failed submit clears the server error', async () => {
  const fake = await openApp('/');
  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  fake.failNext('registerVehicle', 409, 'already-owner');
  await fillForm(SAMPLE_VIN);
  await fireEvent.press(screen.getByRole('button', { name: en.vehicleForm.submit }));
  expect(await screen.findByText(en.errors.codes['already-owner'])).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.make), 'Audi');
  await waitFor(() => expect(screen.queryByText(en.errors.codes['already-owner'])).toBeNull());
});
