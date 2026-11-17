import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { lockedEvents, maxEventDate } from '@/features/event';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { pickedDocuments, putFile } from '../fakes/photos';
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
    details: { kind: 'SCAN', serviceName: 'Brake pads' },
    documentPresent: true,
  });

/** Opens the empty Add event form from the vehicle. */
async function openForm() {
  fake = await openApp(detailUrl, { seed: withCar });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.addEvent }));
  expect(await screen.findByLabelText(en.event.odometer)).toBeTruthy();
}

const pickType = (label: string) => fireEvent.press(screen.getByRole('radio', { name: label }));

/** Picks `date` in the date field `testID` belongs to, whose button is named after its label and the day it shows now. */
async function pickDate(testID: string, label: string, date: Date) {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${label},`) }));
  await fireEvent(screen.getByTestId(testID), 'onChange', { type: 'set', nativeEvent: {} }, date);
}

async function choosePdf(uri: string, name: string) {
  putFile(uri, 1000);
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce(pickedDocuments({ uri, name, size: 1000 }));
  await press(en.event.documents.choosePdf);
}

async function saveAndConfirm() {
  await press(en.event.save);
  await press(en.event.check.confirm);
}

/** Opens the Add event sheet from the vehicle and fills in the numbers every entry needs. */
async function startAddEvent(cost: string) {
  fake = await openApp(detailUrl, { seed: withCar });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.addEvent }));
  await fireEvent.changeText(await screen.findByLabelText(en.event.odometer), '84200');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), cost);
}

defineFeature(feature, (test) => {
  test('Newest first across pages', ({ given, when, then, and }) => {
    let seed: (api: FakeApi) => void;
    given('the API returns events oldest first over 3 pages', () => {
      // 201 events: pages of 100, 100 and 1. Dates and kilometres ascend with the index.
      const events = Array.from({ length: 201 }, (_, i) =>
        anEvent({
          date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10),
          odometerKm: 1000 + i,
          details: { kind: 'SCAN', serviceName: `Event ${i}` },
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
    and('every page was requested with order "desc"', () => {
      for (const call of fake.callsTo('getTimeline')) expect(call.path).toContain('order=desc');
    });
  });

  test('The latest kilometres skip entries without kilometres', ({ given, when, then }) => {
    let seed: (api: FakeApi) => void;
    given(/^the newest entry has no kilometres and an older one has (\d+)$/, (km: string) => {
      seed = withEvents(
        anEvent({ date: '2024-01-10', odometerKm: Number(km) }),
        anEvent({ type: 'ROVINIETA', date: '2024-06-10', odometerKm: null }),
      );
    });
    when('I open the vehicle', async () => {
      fake = await openApp(detailUrl, { seed });
    });
    then(/^the car shows (\d+) km$/, async (km: string) => {
      const facts = await screen.findByTestId('car-facts');
      await waitFor(() => expect(within(facts).getByText(en.garage.odometer(Number(km)))).toBeTruthy());
    });
  });

  test('Only the current policy shows a marker', ({ given, when, then }) => {
    let seed: (api: FakeApi) => void;
    given('two insurance entries, the older superseded by the newer', () => {
      seed = withEvents(
        anEvent({ type: 'INSURANCE', date: '2023-05-01', validFrom: '2023-05-01', validUntil: '2099-04-30' }),
        anEvent({ type: 'INSURANCE', date: '2024-05-01', validFrom: '2024-05-01', validUntil: '2099-12-31' }),
      );
    });
    when('I open the vehicle', async () => {
      fake = await openApp(detailUrl, { seed });
      expect(await screen.findAllByTestId('timeline-item')).toHaveLength(2);
    });
    then('exactly one validity marker is shown', () => {
      expect(screen.getAllByText(/^Valid until /)).toHaveLength(1);
      expect(screen.getByText(en.event.validity.validUntil('31 Dec 2099'))).toBeTruthy();
    });
  });

  test('The compact history opens the full timeline', ({ given, when, then }) => {
    given('a car with history', () => undefined);
    when(/^I tap "(.*)"$/, async (label: string) => {
      fake = await openApp(detailUrl, { seed: withEvents(anEvent()) });
      await fireEvent.press(await screen.findByRole('button', { name: label }));
    });
    then(/^I am on the route "(.*)"$/, async (route: string) => {
      await waitFor(() => expect(screen).toHavePathname(route.replace('/V/', `/${SAMPLE_VIN}/`)));
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
      await press(en.event.check.confirm);
      await waitFor(() => expect(fake.callsTo('updateEvent')).toHaveLength(1));
      const original = documented();
      expect(fake.callsTo('updateEvent')[0].body).toEqual({
        type: original.type,
        date: original.date,
        odometerKm: original.odometerKm,
        costAmount: original.costAmount,
        currency: original.currency,
        notes: 'Changed note',
        components: [],
        customFields: [],
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
      await press(en.event.check.confirm);
    });
    then('I am told a previous owner added it', async () => {
      expect(await screen.findByText(en.errors.codes['event-from-prior-owner'])).toBeTruthy();
    });
    and('edit and delete are hidden for that event', async () => {
      await press(en.common.back);
      expect(await screen.findByText(en.event.detailTitle)).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.event.edit })).toBeNull();
      expect(screen.queryByRole('button', { name: en.event.delete })).toBeNull();
    });
  });

  test('A manual entry is saved as confirmed', ({ when, then, and }) => {
    when('I add an event with default currency', async () => {
      await startAddEvent('350');
      await press(en.event.save);
      await press(en.event.check.confirm);
    });
    then(/^the request has currency "(.*)"$/, async (currency: string) => {
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      expect(fake.callsTo('addEvent')[0].body).toMatchObject({ currency });
    });
    and(/^the new entry shows evidence "(.*)"$/, async (word: string) => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      // The entry's own row; the odometer in the facts shows the same badge.
      expect(within(await screen.findByTestId('timeline-item')).getByLabelText(en.evidence.a11y(word))).toBeTruthy();
    });
  });

  test('A decimal comma is understood', ({ when, then }) => {
    when(/^I add an event costing "(.*)"$/, async (cost: string) => {
      await startAddEvent(cost);
      await press(en.event.save);
      await press(en.event.check.confirm);
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
      await press(en.event.check.confirm);
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

  test('Adding insurance asks for what insurance needs', ({ when, then, and }) => {
    when('I add an event of type Insurance', async () => {
      await openForm();
      await pickType(en.event.type.INSURANCE);
    });
    then('I am asked for coverage, insurer and the validity period', () => {
      expect(screen.getByLabelText(en.event.coverage)).toBeTruthy();
      expect(screen.getByLabelText(en.event.insurer)).toBeTruthy();
      expect(screen.getByRole('button', { name: new RegExp(`^${en.event.validFrom},`) })).toBeTruthy();
      expect(screen.getByRole('button', { name: new RegExp(`^${en.event.validUntilField},`) })).toBeTruthy();
    });
    and('kilometres are optional', async () => {
      expect(screen.getByText(en.event.optional)).toBeTruthy();
      await fireEvent.changeText(screen.getByLabelText(en.event.insurer), 'Allianz');
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '500');
      await fireEvent.press(screen.getByRole('checkbox', { name: en.event.presetMonths(12) }));
      await saveAndConfirm();
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      const body = fake.callsTo('addEvent')[0].body as Record<string, unknown>;
      expect(body).toMatchObject({ type: 'INSURANCE', odometerKm: null, details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz' } });
      expect(body.validFrom).toBe(maxEventDate(new Date()));
      expect(body.validUntil).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    });
  });

  test('Rovinieta shows its computed end', ({ when, then, and }) => {
    when('I add a Rovinieta from 15 Jan 2026 for 12 months', async () => {
      await openForm();
      await pickType(en.event.type.ROVINIETA);
      await pickDate('event-valid-from-picker', en.event.validFrom, new Date(2026, 0, 15, 12));
      await fireEvent.press(screen.getByRole('radio', { name: en.event.durationOption.TWELVE_MONTHS }));
    });
    then('the form previews the end date', () => {
      expect(screen.getByText(en.event.validity.validUntil('14 Jan 2027'))).toBeTruthy();
    });
    and('the request carries no validUntil', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '28');
      await saveAndConfirm();
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      const body = fake.callsTo('addEvent')[0].body as Record<string, unknown>;
      expect(body).toMatchObject({ type: 'ROVINIETA', validFrom: '2026-01-15', details: { kind: 'ROVINIETA', duration: 'TWELVE_MONTHS' } });
      expect(body).not.toHaveProperty('validUntil');
    });
  });

  test('Other needs a name', ({ when, then }) => {
    when('I add an event of type Other without a name', async () => {
      await openForm();
      await pickType(en.event.type.OTHER);
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '90');
      await press(en.event.save);
    });
    then('I cannot save', async () => {
      expect(await screen.findByText(en.event.invalidLabel)).toBeTruthy();
      expect(screen.queryByText(en.event.check.title)).toBeNull();
      expect(fake.callsTo('addEvent')).toHaveLength(0);
    });
  });

  test('Safety equipment asks for item and expiry', ({ when, then, and }) => {
    when('I add an event of type Safety equipment', async () => {
      await openForm();
      await pickType(en.event.type.SAFETY_EQUIPMENT);
    });
    then('I choose between fire extinguisher and first-aid kit', () => {
      expect(screen.getByRole('radio', { name: en.event.safetyItem.FIRE_EXTINGUISHER })).toBeTruthy();
      expect(screen.getByRole('radio', { name: en.event.safetyItem.FIRST_AID_KIT })).toBeTruthy();
    });
    and('"valid until" is required', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '60');
      await press(en.event.save);
      expect(await screen.findByText(en.event.invalidValidUntil)).toBeTruthy();
      expect(screen.getByText(en.event.invalidItem)).toBeTruthy();
      expect(screen.queryByText(en.event.check.title)).toBeNull();
      expect(fake.callsTo('addEvent')).toHaveLength(0);
    });
  });

  test('Paperwork can carry its file', ({ when, then, and }) => {
    when(/^I add an event of type (.*)$/, async (label: string) => {
      await openForm();
      await pickType(label);
    });
    then(/^the documents section says "(.*)"$/, (hint: string) => {
      expect(screen.getByText(hint)).toBeTruthy();
    });
    and('I can attach a photo or PDF before saving', async () => {
      expect(screen.getByRole('button', { name: en.event.documents.choosePhoto })).toBeTruthy();
      await choosePdf('file:///cache/paper.pdf', 'paper.pdf');
      expect(await screen.findByText('paper.pdf')).toBeTruthy();
      expect(fake.callsTo('addAttachment')).toHaveLength(0);
    });
  });

  test('A CASCO saved with its policy file', ({ when, then, and }) => {
    when(/^I add a CASCO with insurer "(.*)" and attach "(.*)"$/, async (insurer: string, file: string) => {
      await openForm();
      await pickType(en.event.type.INSURANCE);
      await fireEvent.press(screen.getByRole('radio', { name: en.event.coverageValue.CASCO }));
      await fireEvent.changeText(screen.getByLabelText(en.event.insurer), insurer);
      await fireEvent.press(screen.getByRole('checkbox', { name: en.event.presetMonths(12) }));
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '800');
      await choosePdf(`file:///cache/${file}`, file);
      expect(await screen.findByText(file)).toBeTruthy();
      await saveAndConfirm();
    });
    then('the event is created and the file is uploaded to it', async () => {
      await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
      expect(fake.callsTo('addEvent')[0].body).toMatchObject({ type: 'INSURANCE', details: { kind: 'INSURANCE', coverage: 'CASCO', insurer: 'Allianz' } });
      expect(fake.state.attachments[fake.state.events[SAMPLE_VIN][0].id][0].contentType).toBe('application/pdf');
    });
    and(/^the entry shows 1 document and evidence "(.*)"$/, async (word: string) => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      const item = await screen.findByTestId('timeline-item');
      await waitFor(() => expect(within(item).getByTestId('timeline-attachments')).toBeTruthy());
      expect(within(item).getByLabelText(en.evidence.a11y(word))).toBeTruthy();
      expect(within(screen.getByTestId('timeline-attachments')).getByText('1')).toBeTruthy();
    });
  });

  test('Components are suggested by type', ({ when, then }) => {
    when('I add an event of type Tires', async () => {
      await openForm();
      await pickType(en.event.type.TIRES);
    });
    then(/^component "(.*)" is preselected$/, async (label: string) => {
      expect(screen.getByRole('checkbox', { name: label }).props.accessibilityState).toMatchObject({ checked: true });
      expect(screen.getByRole('checkbox', { name: en.event.component.ENGINE }).props.accessibilityState).toMatchObject({ checked: false });
      await fireEvent.changeText(screen.getByLabelText(en.event.odometer), '90000');
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '1200');
      await saveAndConfirm();
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      expect(fake.callsTo('addEvent')[0].body).toMatchObject({ type: 'TIRES', components: ['TIRES_WHEELS'] });
    });
  });

  test('Custom fields', ({ when, then }) => {
    when('I add two custom fields to an event', async () => {
      await openForm();
      await fireEvent.changeText(screen.getByLabelText(en.event.odometer), '90000');
      await fireEvent.changeText(screen.getByLabelText(en.event.cost), '100');
      await press(en.event.addCustomField);
      await press(en.event.addCustomField);
      await fireEvent.changeText(screen.getByLabelText(en.event.customFieldName(1)), 'Garage');
      await fireEvent.changeText(screen.getByLabelText(en.event.customFieldValue(1)), 'Bob');
      await fireEvent.changeText(screen.getByLabelText(en.event.customFieldName(2)), 'Tires');
      await fireEvent.changeText(screen.getByLabelText(en.event.customFieldValue(2)), 'Winter');
      await saveAndConfirm();
    });
    then('they are saved on the event in the order I added them', async () => {
      await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
      const fields = [
        { label: 'Garage', value: 'Bob' },
        { label: 'Tires', value: 'Winter' },
      ];
      expect(fake.callsTo('addEvent')[0].body).toMatchObject({ customFields: fields });
      expect(fake.state.events[SAMPLE_VIN][0].customFields).toEqual(fields);
    });
  });

  test('A scanned event lets me tag it', ({ given, when, then, and }) => {
    given('a DOCUMENTED event', () => undefined);
    when('I edit it', async () => {
      fake = await openApp(`${detailUrl}/events/${EVENT_ID}`, { seed: withEvents(documented()) });
      await fireEvent.press(await screen.findByRole('button', { name: en.event.edit }));
      expect(await screen.findByLabelText(en.event.notes)).toBeTruthy();
    });
    then('notes, components and custom fields can be changed', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.event.notes), 'Tagged');
      await fireEvent.press(screen.getByRole('checkbox', { name: en.event.component.BRAKES }));
      await press(en.event.addCustomField);
      await fireEvent.changeText(screen.getByLabelText(en.event.customFieldName(1)), 'Garage');
      await fireEvent.changeText(screen.getByLabelText(en.event.customFieldValue(1)), 'Bob');
    });
    and('the request resends the original facts', async () => {
      await saveAndConfirm();
      await waitFor(() => expect(fake.callsTo('updateEvent')).toHaveLength(1));
      const original = documented();
      expect(fake.callsTo('updateEvent')[0].body).toEqual({
        type: original.type,
        date: original.date,
        odometerKm: original.odometerKm,
        costAmount: original.costAmount,
        currency: original.currency,
        notes: 'Tagged',
        components: ['BRAKES'],
        customFields: [{ label: 'Garage', value: 'Bob' }],
      });
    });
  });
});
