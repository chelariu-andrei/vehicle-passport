import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Share } from 'react-native';

import { en } from '@/shared/i18n/en';

import { aPassport, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

async function openActive() {
  const passport = aPassport({ hash: '9f2c0000000000000000000000000000a41b' });
  const fake = await openApp(`/passports/${passport.id}`, {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.passports.push(passport);
    },
  });
  expect(await screen.findByText(en.passport.frozen)).toBeTruthy();
  return { fake, passport };
}

test('the detail names the car, shows the hash as an integrity checksum and says there is no expiry', async () => {
  await openActive();
  expect(screen.getByText('Volkswagen Golf')).toBeTruthy();
  expect(screen.getByText('9F2C…A41B')).toBeTruthy();
  expect(screen.getByText(en.passport.integrity)).toBeTruthy();
  expect(screen.getByText(en.passport.noExpiry)).toBeTruthy();
});

test('Share link shares the public URL', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  const { passport } = await openActive();
  await press(en.passport.shareLink);
  await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: passport.publicUrl })));
});

test('cancelling the revoke sheet sends nothing', async () => {
  const { fake } = await openActive();
  await press(en.passport.revoke);
  await press(en.common.cancel);
  await waitFor(() => expect(screen.queryByText(en.passport.revokeTitle)).toBeNull());
  expect(fake.callsTo('revokePassport')).toHaveLength(0);
  expect(screen.getByLabelText(en.passport.qrLabel)).toBeTruthy();
});

test('a QR code that fails to load offers a retry that asks again', async () => {
  await openActive();
  const qr = await screen.findByLabelText(en.passport.qrLabel);
  await fireEvent(qr, 'error', { error: 'boom' });
  await fireEvent.press(await screen.findByRole('button', { name: en.passport.qrRetry }));
  expect(await screen.findByLabelText(en.passport.qrLabel)).toBeTruthy();
  expect(screen.queryByRole('button', { name: en.passport.qrRetry })).toBeNull();
});

test('a revoke that finds the passport gone refreshes the list instead of failing silently', async () => {
  const { fake } = await openActive();
  fake.failNext('revokePassport', 404, 'passport-not-found');
  await press(en.passport.revoke);
  await press(en.passport.revokeConfirm);
  await waitFor(() => expect(fake.callsTo('listMyPassports').length).toBeGreaterThan(1));
});

test('the list shows an empty state with no passports', async () => {
  await openApp('/passports', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  expect(await screen.findByText(en.passport.emptyTitle)).toBeTruthy();
});

test('the list shows the car, the status and the frozen label', async () => {
  await openApp('/passports', {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.passports.push(aPassport({ vin: SAMPLE_VIN }));
    },
  });
  expect(await screen.findByText('Volkswagen Golf')).toBeTruthy();
  expect(screen.getByText(en.passport.status.ACTIVE)).toBeTruthy();
  expect(screen.getByText(en.passport.frozen)).toBeTruthy();
});

test('the create sheet offers 7, 30 and 90 days or no expiry, and a chosen period sends a future date', async () => {
  const fake = await openApp(`/vehicles/${SAMPLE_VIN}/passports/new`, { seed: (api) => api.state.vehicles.push(aVehicle()) });
  for (const name of [en.passport.expiry[7], en.passport.expiry[30], en.passport.expiry[90], en.passport.expiry.none]) {
    expect(await screen.findByRole('radio', { name })).toBeTruthy();
  }
  const before = Date.now();
  await fireEvent.press(screen.getByRole('radio', { name: en.passport.expiry[7] }));
  await press(en.passport.createSubmit);
  await waitFor(() => expect(fake.callsTo('createPassport')).toHaveLength(1));
  const { expiresAt } = fake.callsTo('createPassport')[0].body as { expiresAt: string };
  expect(Date.parse(expiresAt) - before).toBeGreaterThan(6.9 * 86_400_000);
  expect(Date.parse(expiresAt) - before).toBeLessThan(7.1 * 86_400_000);
});
