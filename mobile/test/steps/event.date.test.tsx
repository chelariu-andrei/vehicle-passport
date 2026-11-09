import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { formatLocalDate, maxEventDate } from '@/features/event';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

const newEventUrl = `/vehicles/${SAMPLE_VIN}/events/new`;
const seed = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
};

async function openPicker() {
  await fireEvent.press(await screen.findByRole('button', { name: en.event.chooseDate(maxEventDate(new Date())) }));
  return screen.getByTestId('event-date-picker');
}

test('the picker stops at the day the server accepts, and the default date is that day', async () => {
  await openApp(newEventUrl, { seed });
  const picker = await openPicker();
  expect(formatLocalDate(picker.props.maximumDate)).toBe(maxEventDate(new Date()));
});

test('a picked date is the one sent', async () => {
  const fake = await openApp(newEventUrl, { seed });
  const picker = await openPicker();
  await fireEvent(picker, 'onChange', { type: 'set', nativeEvent: {} }, new Date(2024, 2, 9, 12));
  await fireEvent.changeText(screen.getByLabelText(en.event.odometer), '1000');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), '10');
  await fireEvent.press(screen.getByRole('button', { name: en.event.save }));
  await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
  expect(fake.callsTo('addEvent')[0].body).toMatchObject({ date: '2024-03-09' });
});

test('a date past the limit is pulled back to it, never sent', async () => {
  const fake = await openApp(newEventUrl, { seed });
  const picker = await openPicker();
  const future = new Date();
  future.setDate(future.getDate() + 3);
  await fireEvent(picker, 'onChange', { type: 'set', nativeEvent: {} }, future);
  await fireEvent.changeText(screen.getByLabelText(en.event.odometer), '1000');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), '10');
  await fireEvent.press(screen.getByRole('button', { name: en.event.save }));
  await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
  expect(fake.callsTo('addEvent')[0].body).toMatchObject({ date: maxEventDate(new Date()) });
});
