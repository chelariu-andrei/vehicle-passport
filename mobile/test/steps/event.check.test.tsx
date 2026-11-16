import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

const newEventUrl = `/vehicles/${SAMPLE_VIN}/events/new`;
const seed = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
};

async function fill(odometer: string, cost: string) {
  const fake = await openApp(newEventUrl, { seed });
  await fireEvent.changeText(await screen.findByLabelText(en.event.odometer), odometer);
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), cost);
  return fake;
}

const save = () => fireEvent.press(screen.getByRole('button', { name: en.event.save }));

test('Save opens the sheet with the entered facts', async () => {
  const fake = await fill('148200', '350');
  await save();
  expect(await screen.findByText(en.event.check.title)).toBeTruthy();
  expect(screen.getByText(en.event.check.body)).toBeTruthy();
  expect(screen.getByText('148 200 km')).toBeTruthy();
  expect(screen.getByText('350 RON')).toBeTruthy();
  expect(fake.callsTo('addEvent')).toHaveLength(0);
});

test('Go back keeps the form and posts nothing', async () => {
  const fake = await fill('148200', '350');
  await save();
  await fireEvent.press(await screen.findByRole('button', { name: en.event.check.back }));
  await waitFor(() => expect(screen.queryByText(en.event.check.title)).toBeNull());
  expect(screen.getByLabelText(en.event.odometer)).toHaveDisplayValue('148200');
  expect(fake.callsTo('addEvent')).toHaveLength(0);
});

test('confirm posts exactly once even when tapped twice', async () => {
  const fake = await fill('148200', '350');
  await save();
  const confirm = await screen.findByRole('button', { name: en.event.check.confirm });
  await fireEvent.press(confirm);
  await fireEvent.press(confirm);
  await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
  expect(fake.callsTo('addEvent')).toHaveLength(1);
});

test('an invalid form shows field errors and no sheet', async () => {
  const fake = await fill('', '350');
  await save();
  expect(await screen.findByText(en.event.invalidOdometer)).toBeTruthy();
  expect(screen.queryByText(en.event.check.title)).toBeNull();
  expect(fake.callsTo('addEvent')).toHaveLength(0);
});

test('2000 characters of notes still leave the confirm and dismiss buttons rendered', async () => {
  await fill('148200', '350');
  await fireEvent.changeText(screen.getByLabelText(en.event.notes), 'n'.repeat(2000));
  await save();
  expect(await screen.findByRole('button', { name: en.event.check.confirm })).toBeTruthy();
  expect(screen.getByRole('button', { name: en.event.check.back })).toBeTruthy();
});
