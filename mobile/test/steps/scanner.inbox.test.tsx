import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { scanJobStore } from '@/features/scan';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { loseFile, putFile } from '../fakes/photos';
import { aScanJob, aVehicle, SAMPLE_VIN } from '../fake-api';
import type { FakeApi } from '../fake-api';
import { openApp } from '../harness';

jest.setTimeout(15000);

const OTHER_VIN = 'WBAZZZ1JZXW000002';

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function seedJob(status: 'EXTRACTED' | 'CONFIRMED' | 'FAILED' | 'REJECTED', fileKept = true) {
  const job = aScanJob({ status });
  const localUri = `document/${job.id}.jpg`;
  putFile(localUri);
  if (!fileKept) loseFile(localUri);
  await scanJobStore.add(fakeAuth.userId!, [
    { jobId: job.id, vin: SAMPLE_VIN, localUri, submittedAt: '2025-01-15T10:00:00Z', batchId: null },
  ]);
  return {
    job,
    seed: (api: FakeApi) => {
      api.state.vehicles.push(aVehicle());
      api.state.scans[job.id] = job;
    },
  };
}

test('an extracted job opens its review', async () => {
  const { job, seed } = await seedJob('EXTRACTED');
  await openApp('/scans', { seed, routes: { 'scans/[jobId]': () => null } });
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(en.scans.status.ready) }));
  await waitFor(() => expect(screen).toHavePathname(`/scans/${job.id}`));
});

test('a confirmed job leaves the inbox with one toast', async () => {
  const { seed } = await seedJob('CONFIRMED');
  await openApp('/scans', { seed });
  expect(await screen.findByText(en.scans.addedToHistory)).toBeTruthy();
  await waitFor(async () => expect(await scanJobStore.list(fakeAuth.userId!)).toEqual([]));
  expect(screen.getAllByText(en.scans.addedToHistory)).toHaveLength(1);
});

test('a rejected job leaves the inbox quietly', async () => {
  const { seed } = await seedJob('REJECTED');
  await openApp('/scans', { seed });
  await waitFor(async () => expect(await scanJobStore.list(fakeAuth.userId!)).toEqual([]));
  expect(screen.queryByText(en.scans.addedToHistory)).toBeNull();
});

test('a failed job whose photo is kept offers Retry and Enter by hand', async () => {
  const { seed } = await seedJob('FAILED');
  await openApp('/scans', { seed });
  expect(await screen.findByRole('button', { name: en.scans.retry })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: en.scans.enterByHand }));
  await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/events/new`));
});

test('a failed job whose photo is gone offers only Enter by hand', async () => {
  const { seed } = await seedJob('FAILED', false);
  await openApp('/scans', { seed });
  expect(await screen.findByRole('button', { name: en.scans.enterByHand })).toBeTruthy();
  expect(screen.queryByRole('button', { name: en.scans.retry })).toBeNull();
});

test('with several cars the car is chosen first', async () => {
  await openApp('/scans/new', {
    seed: (api) => api.state.vehicles.push(aVehicle(), aVehicle({ vin: OTHER_VIN, model: 'Polo' })),
  });
  expect(await screen.findByText(en.scans.pickCar)).toBeTruthy();
  expect(screen.queryByText(en.scans.onePhoto)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Volkswagen Polo' }));
  expect(await screen.findByText(en.scans.onePhoto)).toBeTruthy();
});
