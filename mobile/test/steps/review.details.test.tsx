import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { scanJobStore } from '@/features/scan';
import type { components } from '@/shared/api/generated/schema';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { putFile } from '../fakes/photos';
import type { FakeApi } from '../fake-api';
import { aScanJob, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

jest.setTimeout(20000);

const r = en.scans.review;
type Fields = NonNullable<components['schemas']['ScanJobResponse']['fields']>;
type Warning = components['schemas']['ScanWarning'];

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const f = (value: unknown, confidence = 0.95) => ({ value, confidence });
const fields = (over: Fields = {}): Fields => ({
  date: f('2024-03-10'),
  odometerKm: f(84200),
  total: f(350),
  parts: f([{ name: 'Oil', qty: 1, price: 120 }]),
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

async function open(o: { fields?: Fields; warnings?: Warning[] } = {}): Promise<FakeApi> {
  const job = aScanJob({ status: 'EXTRACTED', fields: o.fields ?? fields(), warnings: o.warnings ?? [] });
  const localUri = `document/${job.id}.jpg`;
  putFile(localUri);
  await scanJobStore.add(fakeAuth.userId!, [
    { jobId: job.id, vin: SAMPLE_VIN, localUri, submittedAt: '2025-01-15T10:00:00Z', batchId: null },
  ]);
  const fake = await openApp(`/scans/${job.id}`, {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.scans[job.id] = job;
    },
  });
  expect(await screen.findByText(r.title)).toBeTruthy();
  return fake;
}

const sent = (fake: FakeApi) => fake.callsTo('confirmScan')[0].body;

test('malformed extraction opens empty inputs, flagged, and a required value is reported without a request', async () => {
  const fake = await open({
    fields: { odometerKm: f('abc'), date: f('not-a-date'), total: f('12'), parts: f('x') },
  });
  expect(screen.getByLabelText(r.odometer).props.value).toBe('');
  expect(screen.getByLabelText(r.date).props.value).toBe('');
  expect(screen.getByLabelText(r.total).props.value).toBe('');
  expect(screen.queryByLabelText(r.partName(1))).toBeNull();
  // Each unreadable value is marked "Check", in words.
  expect(screen.getAllByText(r.check).length).toBeGreaterThanOrEqual(4);
  await press(r.confirm);
  expect(await screen.findAllByText(r.required)).toHaveLength(3);
  expect(fake.callsTo('confirmScan')).toHaveLength(0);
});

test('a decimal comma is read as a decimal', async () => {
  const fake = await open();
  await fireEvent.changeText(screen.getByLabelText(r.total), '149,50');
  await fireEvent.changeText(screen.getByLabelText(r.labor), '20,5');
  await press(r.confirm);
  await waitFor(() => expect(fake.callsTo('confirmScan')).toHaveLength(1));
  expect(sent(fake)).toMatchObject({ total: 149.5, labor: 20.5 });
});

test('text that is not an amount is refused on its own box', async () => {
  const fake = await open();
  await fireEvent.changeText(screen.getByLabelText(r.total), '1.234,50');
  await press(r.confirm);
  expect(await screen.findByText(r.invalid)).toBeTruthy();
  expect(fake.callsTo('confirmScan')).toHaveLength(0);
});

test('invalid-event highlights date, odometer and total and keeps the edits', async () => {
  const fake = await open();
  await fireEvent.changeText(screen.getByLabelText(r.serviceName), 'Kept text');
  fake.failNext('confirmScan', 422, 'invalid-event');
  await press(r.confirm);
  expect(await screen.findAllByText(en.errors.codes['invalid-event'])).toHaveLength(3);
  expect(screen.getByDisplayValue('Kept text')).toBeTruthy();
});

test('field warnings are shown on their field, others in the list, unknown codes in the server words', async () => {
  const fake = await open({
    warnings: [
      { code: 'DATE_IN_FUTURE', message: 'x' },
      { code: 'ODOMETER_INCONSISTENT', message: 'x' },
      { code: 'SOMETHING_NEW', message: 'From the server' },
    ],
  });
  expect(screen.getByText(r.warnings.DATE_IN_FUTURE)).toBeTruthy();
  expect(screen.getByText(r.warnings.ODOMETER_INCONSISTENT)).toBeTruthy();
  expect(screen.getByText('From the server')).toBeTruthy();
  // They are warnings, not blockers: Confirm is still available.
  await press(r.confirm);
  await waitFor(() => expect(fake.callsTo('confirmScan')).toHaveLength(1));
});

test('the invoice photo is one tap away', async () => {
  await open();
  expect(screen.queryByLabelText(en.scans.photoLabel)).toBeNull();
  await press(r.showPhoto);
  expect(screen.getByLabelText(en.scans.photoLabel)).toBeTruthy();
  await press(r.hidePhoto);
  expect(screen.queryByLabelText(en.scans.photoLabel)).toBeNull();
});

test('parts can be added and removed, and a blank new row is not sent', async () => {
  const fake = await open();
  await press(r.addPart);
  expect(screen.getByLabelText(r.partName(2))).toBeTruthy();
  await press(r.removePart(1));
  expect(screen.queryByLabelText(r.partName(2))).toBeNull();
  await press(r.addPart);
  await press(r.removePart(1));
  await press(r.confirm);
  await waitFor(() => expect(fake.callsTo('confirmScan')).toHaveLength(1));
  expect(sent(fake)).toMatchObject({ parts: [] });
});

test('changing the type and currency is sent', async () => {
  const fake = await open();
  await fireEvent.press(screen.getByRole('radio', { name: en.event.type.REPAIR }));
  await fireEvent.changeText(screen.getByLabelText(r.currency), 'eur');
  await press(r.confirm);
  await waitFor(() => expect(fake.callsTo('confirmScan')).toHaveLength(1));
  expect(sent(fake)).toMatchObject({ type: 'REPAIR', currency: 'EUR' });
});
