import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { lockedEvents } from '@/features/event';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/timeline.feature', { loadRelativePath: true });

let fake: FakeApi;

const detailUrl = `/vehicles/${SAMPLE_VIN}`;
const EVENT_ID = '3f0c2f6e-5b0a-4d58-9d0e-1c7f2a9b4e11';
const written = (File as unknown as { written: { uri: string; data: unknown }[] }).written;

beforeEach(async () => {
  await AsyncStorage.clear();
  lockedEvents.clear();
  written.length = 0;
  jest.clearAllMocks();
});

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

const withCar = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
};
const withEvents = (...events: ReturnType<typeof anEvent>[]) => (api: FakeApi) => {
  withCar(api);
  api.state.events[SAMPLE_VIN] = events;
};
const documented = () =>
  anEvent({
    id: EVENT_ID,
    evidence: 'DOCUMENTED',
    source: 'SCAN',
    notes: 'Scanned note',
    details: { serviceName: 'Brake pads' },
    documentPresent: true,
  });

/** Opens the Add event sheet from the vehicle and fills in the numbers every entry needs. */
async function startAddEvent(cost: string) {
  fake = await openApp(detailUrl, { seed: withCar });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.addEvent }));
  await fireEvent.changeText(await screen.findByLabelText(en.event.odometer), '84200');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), cost);
}

defineFeature(feature, (test) => {
  test('Newest first across pages', ({ given, when, then }) => {
    let seed: (api: FakeApi) => void;
    given('the API returns events oldest first over 3 pages', () => {
      // 201 events: pages of 100, 100 and 1. Dates and kilometres ascend with the index.
      const events = Array.from({ length: 201 }, (_, i) =>
        anEvent({
          date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10),
          odometerKm: 1000 + i,
          details: { serviceName: `Event ${i}` },
        }),
      );
      seed = withEvents(...events);
    });
    when('I open the vehicle', async () => {
      fake = await openApp(detailUrl, { seed });
      expect(await screen.findByText('Event 200')).toBeTruthy();
    });
    then('all events are shown newest first', async () => {
      await waitFor(() => expect(fake.callsTo('getTimeline')).toHaveLength(3));
      const items = screen.getAllByTestId('timeline-item');
      expect(items).toHaveLength(201);
      expect(within(items[0]).getByText('Event 200')).toBeTruthy();
      expect(within(items[200]).getByText('Event 0')).toBeTruthy();
    });
  });

  test('Documented entries only allow notes', ({ given, when, then, and }) => {
    given('a DOCUMENTED event', () => undefined);
    when('I edit it', async () => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(documented()) });
      await fireEvent.press(await screen.findByRole('button', { name: en.event.edit }));
      expect(await screen.findByLabelText(en.event.notes)).toBeTruthy();
    });
    then('only notes can be changed', () => {
      expect(screen.getByText(en.event.documentedNote)).toBeTruthy();
      for (const label of [en.event.odometer, en.event.cost, en.event.currency, en.event.date]) {
        expect(screen.queryByLabelText(label)).toBeNull();
      }
      expect(screen.queryByRole('radio')).toBeNull();
    });
    and('the request resends the original type, date, odometer, cost and currency', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.event.notes), 'Changed note');
      await press(en.event.save);
      await waitFor(() => expect(fake.callsTo('updateEvent')).toHaveLength(1));
      const original = documented();
      expect(fake.callsTo('updateEvent')[0].body).toEqual({
        type: original.type,
        date: original.date,
        odometerKm: original.odometerKm,
        costAmount: original.costAmount,
        currency: original.currency,
        notes: 'Changed note',
      });
    });
  });

  test('Prior-owner entry', ({ when, then, and }) => {
    when(/^an edit answers 403 "(.*)"$/, async (code: string) => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(anEvent({ id: EVENT_ID })) });
      await fireEvent.press(await screen.findByRole('button', { name: en.event.edit }));
      await fireEvent.changeText(await screen.findByLabelText(en.event.notes), 'Try');
      fake.failNext('updateEvent', 403, code);
      await press(en.event.save);
    });
    then('I am told a previous owner added it', async () => {
      expect(await screen.findByText(en.errors.codes['event-from-prior-owner'])).toBeTruthy();
    });
    and('edit and delete are hidden for that event', async () => {
      await press(en.common.cancel);
      expect(await screen.findByText(en.event.detailTitle)).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.event.edit })).toBeNull();
      expect(screen.queryByRole('button', { name: en.event.delete })).toBeNull();
    });
  });

  test('A manual entry is saved as confirmed', ({ when, then, and }) => {
    when('I add an event with default currency', async () => {
      await startAddEvent('350');
      await press(en.event.save);
    });
    then(/^the request has currency "(.*)"$/, async (currency: string) => {
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      expect(fake.callsTo('addEvent')[0].body).toMatchObject({ currency });
    });
    and(/^the new entry shows evidence "(.*)"$/, async (word: string) => {
      await waitFor(() => expect(screen).toHavePathname(detailUrl));
      expect(await screen.findByLabelText(en.evidence.a11y(word))).toBeTruthy();
    });
  });

  test('A decimal comma is understood', ({ when, then }) => {
    when(/^I add an event costing "(.*)"$/, async (cost: string) => {
      await startAddEvent(cost);
      await press(en.event.save);
    });
    then(/^the request has costAmount (.*)$/, async (amount: string) => {
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      expect(fake.callsTo('addEvent')[0].body).toMatchObject({ costAmount: Number(amount) });
    });
  });

  test('Deleting explains what stays', ({ when, then }) => {
    when('I choose Delete on an event', async () => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(anEvent({ id: EVENT_ID })) });
      await fireEvent.press(await screen.findByRole('button', { name: en.event.delete }));
    });
    then('I am told existing passports keep this entry', () => {
      expect(screen.getByText(en.event.deleteBody)).toBeTruthy();
      expect(en.event.deleteBody).toMatch(/existing passports keep this entry/i);
      expect(fake.callsTo('deleteEvent')).toHaveLength(0);
    });
  });

  test('A private invoice', ({ given, when, then }) => {
    given('an event with a document', () => undefined);
    when(/^I view the invoice and the API answers 403 "(.*)"$/, async (code: string) => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(documented()) });
      const view = await screen.findByRole('button', { name: en.event.viewInvoice });
      fake.failNext('getEventDocument', 403, code);
      await fireEvent.press(view);
    });
    then(/^I am told "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });
  });

  test('An invoice can be opened', ({ given, when, then }) => {
    given('an event with a document', () => undefined);
    when('I view the invoice', async () => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(documented()) });
      await fireEvent.press(await screen.findByRole('button', { name: en.event.viewInvoice }));
    });
    then('the system share sheet opens with that file', async () => {
      await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
      expect(Sharing.shareAsync).toHaveBeenCalledWith(expect.stringMatching(/\.jpg$/), expect.objectContaining({ mimeType: 'image/jpeg' }));
      expect(written).toHaveLength(1);
      expect(Array.from(new Uint8Array(written[0].data as ArrayBuffer))).toEqual([0xff, 0xd8, 0xff, 0xd9]);
      expect(fake.callsTo('getEventDocument')).toHaveLength(1);
    });
  });

  test('No invoice, no button', ({ given, then }) => {
    given('an event without a document', () => undefined);
    then(/^"(.*)" is not offered$/, async (label: string) => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(anEvent({ id: EVENT_ID })) });
      expect(await screen.findByText(en.event.detailTitle)).toBeTruthy();
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    });
  });

  test('Mileage that does not fit', ({ when, then, and }) => {
    when(/^saving an event answers 422 "(.*)"$/, async (code: string) => {
      await startAddEvent('350');
      fake.failNext('addEvent', 422, code);
      await press(en.event.save);
    });
    then(/^I am told "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
    });
    and('my input is kept', () => {
      expect(screen.getByLabelText(en.event.odometer)).toHaveDisplayValue('84200');
      expect(screen.getByLabelText(en.event.cost)).toHaveDisplayValue('350');
      expect(screen).toHavePathname(`${detailUrl}/events/new`);
    });
  });
});
