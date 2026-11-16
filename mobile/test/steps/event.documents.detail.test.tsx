import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { lockedEvents } from '@/features/event';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { anAttachment, aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { anAsset, picked } from '../fakes/photos';
import { openApp } from '../harness';

const EVENT_ID = '3f0c2f6e-5b0a-4d58-9d0e-1c7f2a9b4e11';
const detailUrl = `/vehicles/${SAMPLE_VIN}/events/${EVENT_ID}`;
const editUrl = `${detailUrl}/edit`;

const seedWith =
  (attachments = [anAttachment({ contentType: 'image/jpeg' })], event: Partial<ReturnType<typeof anEvent>> = {}) =>
  (api: FakeApi) => {
    api.state.vehicles.push(aVehicle());
    api.state.events[SAMPLE_VIN] = [anEvent({ id: EVENT_ID, attachmentCount: attachments.length, ...event })];
    api.state.attachments[EVENT_ID] = attachments;
  };

beforeEach(() => lockedEvents.clear());

const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));
const saveAndConfirm = async () => {
  await press(en.event.save);
  await press(en.event.check.confirm);
};

test('detail lists attachments and opens one', async () => {
  const fake = await openApp(detailUrl, { seed: seedWith() });
  await press(en.event.documents.photo(1));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
  expect(fake.callsTo('getAttachment')).toHaveLength(1);
});

test('detail hints that documents can be viewed or downloaded', async () => {
  await openApp(detailUrl, { seed: seedWith() });
  expect(await screen.findByText(en.event.documents.openHint)).toBeTruthy();
  expect(screen.queryByText(en.event.documents.empty)).toBeNull();
});

test('detail without documents says so', async () => {
  await openApp(detailUrl, { seed: seedWith([]) });
  expect(await screen.findByText(en.event.documents.empty)).toBeTruthy();
  expect(screen.queryByText(en.event.documents.openHint)).toBeNull();
});

test('detail is read-only: no add, delete or retry', async () => {
  await openApp(detailUrl, { seed: seedWith() });
  await screen.findByRole('button', { name: en.event.documents.photo(1) });
  expect(screen.queryByRole('button', { name: en.event.documents.deleteDocument(en.event.documents.photo(1)) })).toBeNull();
  expect(screen.queryByRole('button', { name: en.event.documents.choosePhoto })).toBeNull();
  expect(screen.queryByRole('button', { name: en.event.documents.takePhoto })).toBeNull();
  expect(screen.queryByRole('button', { name: en.event.documents.choosePdf })).toBeNull();
});

test('edit: delete asks first and removes it', async () => {
  const fake = await openApp(editUrl, { seed: seedWith() });
  await press(en.event.documents.deleteDocument(en.event.documents.photo(1)));
  expect(fake.callsTo('deleteAttachment')).toHaveLength(0);
  await press(en.event.documents.deleteConfirm);
  await waitFor(() => expect(fake.callsTo('deleteAttachment')).toHaveLength(1));
  await waitFor(() => expect(screen.queryByText(en.event.documents.photo(1))).toBeNull());
});

test('edit: keeping a document closes the sheet without deleting', async () => {
  const fake = await openApp(editUrl, { seed: seedWith() });
  await press(en.event.documents.deleteDocument(en.event.documents.photo(1)));
  await press(en.event.documents.deleteKeep);
  expect(fake.callsTo('deleteAttachment')).toHaveLength(0);
});

test('edit: scan source has no delete', async () => {
  await openApp(editUrl, { seed: seedWith([anAttachment({ kind: 'SCAN_SOURCE', sha256: null, contentType: 'application/pdf' })]) });
  await screen.findByRole('button', { name: en.event.documents.scanSource });
  expect(screen.queryByRole('button', { name: en.event.documents.deleteDocument(en.event.documents.scanSource) })).toBeNull();
});

test('edit: a picked photo waits for Save, then uploads', async () => {
  const fake = await openApp(editUrl, { seed: seedWith([]) });
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked(anAsset()));
  await press(en.event.documents.choosePhoto);
  await screen.findByText(en.event.documents.photo(1));
  expect(fake.callsTo('addAttachment')).toHaveLength(0);
  await saveAndConfirm();
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
  expect(fake.callsTo('updateEvent')).toHaveLength(1);
  await waitFor(() => expect(screen.queryByText(en.event.editTitle)).toBeNull());
});

test('edit: a failed upload is reported on Save and the update is kept', async () => {
  const fake = await openApp(editUrl, { seed: seedWith([]) });
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked(anAsset()));
  await press(en.event.documents.choosePhoto);
  await screen.findByText(en.event.documents.photo(1));
  fake.failNext('addAttachment', 500, null);
  await saveAndConfirm();
  expect(await screen.findByText(en.event.documents.failedUploads(1, 1))).toBeTruthy();
  expect(fake.callsTo('updateEvent')).toHaveLength(1);
});

test('timeline shows paperclip with count', async () => {
  await openApp(`/vehicles/${SAMPLE_VIN}`, { seed: seedWith([anAttachment(), anAttachment()]) });
  const row = await screen.findByTestId('timeline-item');
  expect(row.props.accessibilityLabel).toContain(en.event.documents.count(2));
  expect(within(screen.getByTestId('timeline-attachments')).getByText('2')).toBeTruthy();
});

test('timeline shows no paperclip without attachments', async () => {
  await openApp(`/vehicles/${SAMPLE_VIN}`, { seed: seedWith([]) });
  await screen.findByTestId('timeline-item');
  expect(screen.queryByTestId('timeline-attachments')).toBeNull();
});

test('later owner sees count but no list', async () => {
  lockedEvents.lock(EVENT_ID);
  const fake = await openApp(detailUrl, { seed: seedWith([anAttachment(), anAttachment()]) });
  expect(await screen.findByText(en.event.documents.count(2))).toBeTruthy();
  expect(screen.getByText(en.errors.codes['document-restricted'])).toBeTruthy();
  expect(fake.callsTo('listAttachments')).toHaveLength(0);
});

test('a restricted list answer also falls back to the count', async () => {
  const seed = seedWith([anAttachment()]);
  await openApp(detailUrl, {
    seed: (api) => {
      seed(api);
      api.failNext('listAttachments', 403, 'document-restricted');
    },
  });
  await screen.findByText(en.event.documents.count(1));
  expect(screen.getByText(en.errors.codes['document-restricted'])).toBeTruthy();
});

test('edit: the picker only offers the room that is left', async () => {
  await openApp(editUrl, { seed: seedWith(Array.from({ length: 8 }, () => anAttachment())) });
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked(anAsset(), anAsset(), anAsset()));
  await press(en.event.documents.choosePhoto);
  expect(jest.mocked(ImagePicker.launchImageLibraryAsync).mock.calls.at(-1)?.[0]).toMatchObject({ selectionLimit: 2 });
  expect(await screen.findByText(en.event.documents.limit)).toBeTruthy();
});

test('a manual entry with an upload shows no separate View invoice button', async () => {
  await openApp(detailUrl, { seed: seedWith([anAttachment({ contentType: 'image/jpeg' })], { source: 'MANUAL', documentPresent: true }) });
  await screen.findByRole('button', { name: en.event.documents.photo(1) });
  expect(screen.queryByRole('button', { name: en.event.viewInvoice })).toBeNull();
});
