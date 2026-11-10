/* Polling is counted through the real inbox: how many times the fake API was asked about a job. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { scanJobStore } from '@/features/scan';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { putFile } from '../fakes/photos';
import { aScanJob, aVehicle, SAMPLE_VIN } from '../fake-api';
import type { FakeApi } from '../fake-api';
import { openApp } from '../harness';

jest.setTimeout(20000);

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** Resolves if no further request arrives within `ms` (a real wait: RNTL's waitFor is the timer that works under this preset). */
async function expectNoMoreCalls(fake: FakeApi, settled: number, ms = 2600) {
  await expect(waitFor(() => expect(fake.callsTo('getScan').length).toBeGreaterThan(settled), { timeout: ms })).rejects.toThrow();
  expect(fake.callsTo('getScan')).toHaveLength(settled);
}

async function openInboxWith(status: 'PROCESSING', setup: (api: FakeApi) => void = () => undefined) {
  const job = aScanJob({ status });
  putFile(`document/${job.id}.jpg`);
  await scanJobStore.add(fakeAuth.userId!, [
    { jobId: job.id, vin: SAMPLE_VIN, localUri: `document/${job.id}.jpg`, submittedAt: '2025-01-15T10:00:00Z', batchId: null },
  ]);
  const fake = await openApp('/scans', {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.scans[job.id] = job;
      setup(api);
    },
  });
  expect(await screen.findByText(en.scans.status.reading)).toBeTruthy();
  return { fake, job };
}

test('polling stops once the job is EXTRACTED', async () => {
  const { fake, job } = await openInboxWith('PROCESSING');
  await waitFor(() => expect(fake.callsTo('getScan').length).toBeGreaterThan(0), { timeout: 5000 });
  fake.state.scans[job.id].status = 'EXTRACTED';
  expect(await screen.findByText(en.scans.status.ready, {}, { timeout: 8000 })).toBeTruthy();
  const settled = fake.callsTo('getScan').length;
  await expectNoMoreCalls(fake, settled);
});

test('no job is polled while the Scans tab is not focused', async () => {
  const { fake } = await openInboxWith('PROCESSING');
  await waitFor(() => expect(fake.callsTo('getScan').length).toBeGreaterThan(0), { timeout: 5000 });
  await fireEvent.press(screen.getByRole('button', { name: en.scans.scanInvoice })); // a screen on top of the tabs unfocuses them
  await waitFor(() => expect(screen).toHavePathname('/scans/new'));
  const settled = fake.callsTo('getScan').length;
  await expectNoMoreCalls(fake, settled);
});

test('polling resumes after the first poll failed', async () => {
  const { fake, job } = await openInboxWith('PROCESSING', (api) => api.failNext('getScan', 503, null));
  await waitFor(() => expect(fake.callsTo('getScan')).toHaveLength(1), { timeout: 5000 });
  fake.state.scans[job.id].status = 'EXTRACTED';
  expect(await screen.findByText(en.scans.status.ready, {}, { timeout: 8000 })).toBeTruthy();
  expect(fake.callsTo('getScan').length).toBeGreaterThanOrEqual(2);
});
