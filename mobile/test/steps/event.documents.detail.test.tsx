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

const seedWith =
  (attachments = [anAttachment({ contentType: 'image/jpeg' })], event: Partial<ReturnType<typeof anEvent>> = {}) =>
  (api: FakeApi) => {
    api.state.vehicles.push(aVehicle());
    api.state.events[SAMPLE_VIN] = [anEvent({ id: EVENT_ID, attachmentCount: attachments.length, ...event })];
    api.state.attachments[EVENT_ID] = attachments;
  };

beforeEach(() => lockedEvents.clear());

const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));

test('detail lists attachments and opens one', async () => {
  const fake = await openApp(detailUrl, { seed: seedWith() });
  await press(en.event.documents.photo(1));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
  expect(fake.callsTo('getAttachment')).toHaveLength(1);
});

test('delete asks first and removes it', async () => {
  const fake = await openApp(detailUrl, { seed: seedWith() });
  await press(en.event.documents.deleteDocument(en.event.documents.photo(1)));
  expect(fake.callsTo('deleteAttachment')).toHaveLength(0);
  await press(en.event.documents.deleteConfirm);
  await waitFor(() => expect(fake.callsTo('deleteAttachment')).toHaveLength(1));
  await waitFor(() => expect(screen.queryByText(en.event.documents.photo(1))).toBeNull());
});

test('keeping a document closes the sheet without deleting', async () => {
  const fake = await openApp(detailUrl, { seed: seedWith() });
  await press(en.event.documents.deleteDocument(en.event.documents.photo(1)));
  await press(en.event.documents.deleteKeep);
  expect(fake.callsTo('deleteAttachment')).toHaveLength(0);
});

test('scan source has no delete', async () => {
  await openApp(detailUrl, { seed: seedWith([anAttachment({ kind: 'SCAN_SOURCE', sha256: null, contentType: 'application/pdf' })]) });
  await screen.findByRole('button', { name: en.event.documents.scanSource });
  expect(screen.queryByRole('button', { name: en.event.documents.deleteDocument(en.event.documents.scanSource) })).toBeNull();
});

test('add document uploads the picked photo and the list grows', async () => {
  const fake = await openApp(detailUrl, { seed: seedWith([]) });
  await press(en.event.documents.add);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked(anAsset()));
  await press(en.event.documents.choosePhoto);
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
  expect(await screen.findByRole('button', { name: en.event.documents.photo(1) })).toBeTruthy();
});

test('failed upload banner retries through the add document picker', async () => {
  const fake = await openApp(`${detailUrl}?failedUploads=1&totalUploads=2&duplicateUploads=0`, { seed: seedWith() });
  expect(await screen.findByText(en.event.documents.failedUploads(1, 2))).toBeTruthy();
  expect(screen.getByText('1 of 2 documents did not upload')).toBeTruthy();
  await press(en.event.documents.retry);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked(anAsset()));
  await press(en.event.documents.choosePhoto);
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
  await waitFor(() => expect(screen.queryByText(en.event.documents.failedUploads(1, 2))).toBeNull());
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
  expect(screen.queryByRole('button', { name: en.event.documents.add })).toBeNull();
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
