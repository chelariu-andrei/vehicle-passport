import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { scanJobStore } from '@/features/scan';
import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { loseFile, putFile } from '../fakes/photos';
import type { FakeApi } from '../fake-api';
import { aScanJob, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
jest.setTimeout(20000);
const feature = loadFeature('../../features/review.feature', { loadRelativePath: true });

const r = en.scans.review;
type Fields = NonNullable<components['schemas']['ScanJobResponse']['fields']>;
type Warning = components['schemas']['ScanWarning'];

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const field = (label: string) => screen.getByLabelText(label);

const field95 = (value: unknown, confidence = 0.95) => ({ value, confidence });
const goodFields = (over: Fields = {}): Fields => ({
  serviceName: field95('Auto Service SRL'),
  date: field95('2024-03-10'),
  odometerKm: field95(84200),
  total: field95(350),
  parts: field95([{ name: 'Oil', qty: 1, price: 120 }]),
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** An EXTRACTED job on the device and on the fake server. */
async function extracted(o: { fields?: Fields; warnings?: Warning[]; batchId?: string | null; photo?: 'kept' | 'gone' } = {}) {
  const job = aScanJob({ status: 'EXTRACTED', fields: o.fields ?? goodFields(), warnings: o.warnings ?? [] });
  const localUri = `document/${job.id}.jpg`;
  putFile(localUri);
  if (o.photo === 'gone') loseFile(localUri);
  await scanJobStore.add(fakeAuth.userId!, [
    { jobId: job.id, vin: SAMPLE_VIN, localUri, submittedAt: '2025-01-15T10:00:00Z', batchId: o.batchId ?? null },
  ]);
  return job;
}

const seedWith = (...jobs: ReturnType<typeof aScanJob>[]) => (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
  for (const job of jobs) api.state.scans[job.id] = job;
};

async function openReview(job: ReturnType<typeof aScanJob>, others: ReturnType<typeof aScanJob>[] = []) {
  const fake = await openApp(`/scans/${job.id}`, { seed: seedWith(job, ...others) });
  expect(await screen.findByText(r.title)).toBeTruthy();
  return fake;
}

const events = (fake: FakeApi) => fake.state.events[SAMPLE_VIN] ?? [];

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let job: ReturnType<typeof aScanJob>;

  test('Nothing is saved without confirmation', ({ given, then }) => {
    given('a job is EXTRACTED', async () => {
      job = await extracted();
      fake = await openReview(job);
    });
    then('no event exists until I press confirm', async () => {
      expect(fake.callsTo('confirmScan')).toHaveLength(0);
      expect(events(fake)).toHaveLength(0);
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
      expect(events(fake)[0]).toMatchObject({ evidence: 'DOCUMENTED', source: 'SCAN', odometerKm: 84200, costAmount: 350 });
      expect(fake.callsTo('confirmScan')[0].body).toMatchObject({
        type: 'SERVICE',
        currency: 'RON',
        date: '2024-03-10',
        parts: [{ name: 'Oil', qty: 1, price: 120 }],
      });
    });
  });

  test('Low confidence does not block', ({ given, then, and }) => {
    given('a field has confidence 0.5', async () => {
      job = await extracted({ fields: goodFields({ total: field95(350, 0.5) }) });
      fake = await openReview(job);
    });
    then('it is marked "Check"', () => {
      expect(screen.getAllByText(r.check)).toHaveLength(1);
    });
    and('I can still confirm', async () => {
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
    });
  });

  test('Contradictory mileage is correctable', ({ when, then }) => {
    when(/^confirm answers 422 "(.*)"$/, async (code: string) => {
      job = await extracted();
      fake = await openReview(job);
      await fireEvent.changeText(field(r.odometer), '90000');
      await fireEvent.changeText(field(r.serviceName), 'Edited service');
      fake.failNext('confirmScan', 422, code);
      await press(r.confirm);
    });
    then('my edits are kept and the odometer field is highlighted', async () => {
      expect(await screen.findByText(en.errors.codes['odometer-inconsistent'])).toBeTruthy();
      expect(screen.getByDisplayValue('90000')).toBeTruthy();
      expect(screen.getByDisplayValue('Edited service')).toBeTruthy();
      expect(events(fake)).toHaveLength(0);
      // Correcting the value clears the highlight, and the job can be confirmed again.
      await fireEvent.changeText(field(r.odometer), '90500');
      await waitFor(() => expect(screen.queryByText(en.errors.codes['odometer-inconsistent'])).toBeNull());
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
      expect(events(fake)[0].odometerKm).toBe(90500);
    });
  });

  test('Type and currency are always shown', ({ given, then }) => {
    given('a job is EXTRACTED', async () => {
      job = await extracted({ fields: {} });
      fake = await openReview(job);
    });
    then(/^I see the type "(.*)" and the currency "(.*)"$/, (type: string, currency: string) => {
      expect(screen.getByRole('radio', { name: type, selected: true })).toBeTruthy();
      expect(screen.getByDisplayValue(currency)).toBeTruthy();
    });
  });

  test('A total mismatch is shown and does not block', ({ given, then, and }) => {
    given('a job warns TOTAL_MISMATCH', async () => {
      job = await extracted({ warnings: [{ code: 'TOTAL_MISMATCH', message: 'server words' }] });
      fake = await openReview(job);
    });
    then('I see the warning', () => {
      expect(screen.getByText(r.warnings.TOTAL_MISMATCH)).toBeTruthy();
    });
    and('I can still confirm', async () => {
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
    });
  });

  test('A part with no quantity must be completed', ({ given, when, then }) => {
    given('a part with no quantity', async () => {
      job = await extracted({ fields: goodFields({ parts: field95([{ name: 'Oil', qty: null, price: 120 }]) }) });
      fake = await openReview(job);
      expect(field(en.scans.review.partQty(1)).props.value).toBe('');
    });
    when('I confirm', async () => {
      await press(r.confirm);
    });
    then('the quantity is highlighted and no request is sent', async () => {
      expect(await screen.findByText(r.required)).toBeTruthy();
      expect(screen.getAllByText(r.required)).toHaveLength(1);
      expect(fake.callsTo('confirmScan')).toHaveLength(0);
      await fireEvent.changeText(field(r.partQty(1)), '2');
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
      expect(fake.callsTo('confirmScan')[0].body).toMatchObject({ parts: [{ name: 'Oil', qty: 2, price: 120 }] });
    });
  });

  test('Confirming twice sends once', ({ when, then }) => {
    when('I press confirm twice', async () => {
      job = await extracted();
      fake = await openReview(job);
      const button = screen.getByRole('button', { name: r.confirm });
      await fireEvent.press(button);
      await fireEvent.press(button);
    });
    then('one confirmation is requested', async () => {
      await waitFor(() => expect(events(fake)).toHaveLength(1));
      expect(fake.callsTo('confirmScan')).toHaveLength(1);
    });
  });

  test('The job changed underneath me', ({ when, then }) => {
    when(/^confirm answers 409 "(.*)"$/, async (code: string) => {
      job = await extracted();
      fake = await openReview(job);
      // Another device cancelled it while the form was open.
      fake.state.scans[job.id].status = 'CANCELLED';
      fake.failNext('confirmScan', 409, code);
      await press(r.confirm);
    });
    then('the current status is shown', async () => {
      expect(await screen.findByText(en.scans.status.cancelled)).toBeTruthy();
      expect(screen.queryByRole('button', { name: r.confirm })).toBeNull();
      expect(events(fake)).toHaveLength(0);
    });
  });

  test('Rejecting asks first', ({ when, then }) => {
    when('I choose Reject and confirm', async () => {
      job = await extracted();
      fake = await openReview(job);
      await press(r.reject);
      expect(await screen.findByText(r.rejectTitle)).toBeTruthy();
      expect(fake.callsTo('rejectScan')).toHaveLength(0);
      await press(r.rejectConfirm);
    });
    then('the job leaves my inbox', async () => {
      await waitFor(() => expect(fake.callsTo('rejectScan')).toHaveLength(1));
      await waitFor(() => expect(screen).toHavePathname('/scans'));
      expect(await scanJobStore.list(fakeAuth.userId!)).toEqual([]);
      expect(screen.queryByText(en.scans.status.ready)).toBeNull();
    });
  });

  test('The next invoice in a batch', ({ given, when, then }) => {
    let second: ReturnType<typeof aScanJob>;
    given('two extracted jobs from one batch', async () => {
      job = await extracted({ batchId: 'batch-1' });
      second = await extracted({ batchId: 'batch-1', fields: goodFields({ serviceName: field95('Second garage') }) });
      fake = await openReview(job, [second]);
    });
    when('I confirm the first', async () => {
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
    });
    then('the second opens', async () => {
      await waitFor(() => expect(screen).toHavePathname(`/scans/${second.id}`));
      expect(await screen.findByDisplayValue('Second garage')).toBeTruthy();
      expect(screen.queryByDisplayValue('Auto Service SRL')).toBeNull();
    });
  });

  test('The local photo is gone', ({ given, when, then }) => {
    given("the job's local photo no longer exists", async () => {
      job = await extracted({ photo: 'gone' });
    });
    when('I open Review', async () => {
      fake = await openReview(job);
    });
    then('the form works without the preview', async () => {
      expect(screen.queryByRole('button', { name: r.showPhoto })).toBeNull();
      await press(r.confirm);
      await waitFor(() => expect(events(fake)).toHaveLength(1));
    });
  });
});
