import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, SAMPLE_VIN } from '../fake-api';
import { anAsset, pickedDocuments, picked, putFile } from '../fakes/photos';
import { openApp } from '../harness';

const newEventUrl = `/vehicles/${SAMPLE_VIN}/events/new`;
const seed = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
};

async function open() {
  const fake = await openApp(newEventUrl, { seed });
  await fireEvent.changeText(await screen.findByLabelText(en.event.odometer), '148200');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), '350');
  return fake;
}

const press = async (name: string) => fireEvent.press(await screen.findByRole('button', { name }));

async function choosePhotos(count: number) {
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce(picked(...Array.from({ length: count }, () => anAsset())));
  await press(en.event.documents.choosePhoto);
}

async function choosePdf(uri: string, name: string, size = 1000) {
  putFile(uri, size);
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce(pickedDocuments({ uri, name, size }));
  await press(en.event.documents.choosePdf);
}

const saveAndConfirm = async () => {
  await press(en.event.save);
  await press(en.event.check.confirm);
};

test('the section shows the three buttons and the limits', async () => {
  await open();
  expect(await screen.findByRole('button', { name: en.event.documents.takePhoto })).toBeTruthy();
  expect(screen.getByRole('button', { name: en.event.documents.choosePhoto })).toBeTruthy();
  expect(screen.getByRole('button', { name: en.event.documents.choosePdf })).toBeTruthy();
  expect(screen.getByText('Up to 10 files, 10 MB each')).toBeTruthy();
});

test('staged files upload after the event is created', async () => {
  const fake = await open();
  await choosePhotos(1);
  await screen.findByText(en.event.documents.photo(1));
  expect(fake.callsTo('addEvent')).toHaveLength(0);
  expect(fake.callsTo('addAttachment')).toHaveLength(0);
  await saveAndConfirm();
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
  expect(fake.callsTo('addEvent')).toHaveLength(1);
  expect(fake.state.events[SAMPLE_VIN]).toHaveLength(1);
  await waitFor(() => expect(screen.queryByText(en.event.addTitle)).toBeNull());
});

test('a PDF picked without an extension is copied under a .pdf name before it goes', async () => {
  const fake = await open();
  await choosePdf('content://docs/42', 'invoice');
  await screen.findByText('invoice');
  await saveAndConfirm();
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
  const sent = fake.state.attachments[fake.state.events[SAMPLE_VIN][0].id];
  expect(sent[0].contentType).toBe('application/pdf');
});

test('a PDF over 10 MB is refused and not staged', async () => {
  await open();
  await choosePdf('file:///cache/big.pdf', 'big.pdf', 10_485_761);
  expect(await screen.findByText(en.event.documents.tooLarge)).toBeTruthy();
  expect(screen.queryByText('big.pdf')).toBeNull();
});

test('files can be removed before saving', async () => {
  const fake = await open();
  await choosePhotos(2);
  await screen.findByText(en.event.documents.photo(2));
  await press(en.event.documents.remove(en.event.documents.photo(2)));
  expect(screen.queryByText(en.event.documents.photo(2))).toBeNull();
  await saveAndConfirm();
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
});

test('summary sheet shows "2 files"', async () => {
  await open();
  await choosePhotos(2);
  await screen.findByText(en.event.documents.photo(2));
  await press(en.event.save);
  expect(await screen.findByText('2 files')).toBeTruthy();
});

test('a duplicate file is reported and skipped', async () => {
  const fake = await open();
  await choosePhotos(2);
  await screen.findByText(en.event.documents.photo(2));
  await saveAndConfirm();
  // The device files are all empty, so the second is a copy of the first.
  expect(await screen.findByText(`${en.event.documents.failedUploads(1, 2)} ${en.event.documents.duplicateUploads(1)}`)).toBeTruthy();
  expect(fake.state.events[SAMPLE_VIN]).toHaveLength(1);
});

test('event is kept when an upload fails', async () => {
  const fake = await open();
  await choosePhotos(1);
  await screen.findByText(en.event.documents.photo(1));
  fake.failNext('addAttachment', 500, null);
  await saveAndConfirm();
  expect(await screen.findByText(en.event.documents.failedUploads(1, 1))).toBeTruthy();
  expect(fake.state.events[SAMPLE_VIN]).toHaveLength(1);
});

test('a lost connection mid-upload keeps the event and counts the unsent files as failed', async () => {
  const fake = await open();
  await choosePhotos(3);
  await screen.findByText(en.event.documents.photo(3));
  const online = globalThis.fetch;
  let uploads = 0;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    if ((args[0] as Request).method === 'POST' && (args[0] as Request).url.includes('/attachments') && ++uploads === 2) throw new TypeError('Network request failed');
    return online(...args);
  }) as typeof fetch;
  try {
    await saveAndConfirm();
    expect(await screen.findByText(en.event.documents.failedUploads(2, 3))).toBeTruthy();
  } finally {
    globalThis.fetch = online;
  }
  expect(fake.state.events[SAMPLE_VIN]).toHaveLength(1);
  expect(uploads).toBe(2);
});

/** Holds every upload until `release` is called. */
function holdUploads() {
  const online = globalThis.fetch;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
    if ((args[0] as Request).url.includes('/attachments')) await gate;
    return online(...args);
  }) as typeof fetch;
  return { release, restore: () => (globalThis.fetch = online) };
}

test('back is ignored while the files are uploading, and the upload still finishes', async () => {
  const fake = await open();
  await choosePhotos(1);
  await screen.findByText(en.event.documents.photo(1));
  const held = holdUploads();
  try {
    await saveAndConfirm();
    await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));
    expect(screen.getByText(en.event.addTitle)).toBeTruthy();
    held.release();
    await waitFor(() => expect(screen.queryByText(en.event.addTitle)).toBeNull());
  } finally {
    held.restore();
  }
  expect(fake.state.attachments[fake.state.events[SAMPLE_VIN][0].id]).toHaveLength(1);
});

test('a swipe-back or router pop is blocked while the files are uploading', async () => {
  // Opened from a screen underneath, so that there is something to pop to.
  const fake = await openApp('/', { seed, routes: { '(tabs)/index': () => null } });
  await act(async () => router.push(newEventUrl));
  await fireEvent.changeText(await screen.findByLabelText(en.event.odometer), '148200');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), '350');
  await choosePhotos(1);
  await screen.findByText(en.event.documents.photo(1));
  const held = holdUploads();
  try {
    await saveAndConfirm();
    await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
    await act(async () => router.back());
    expect(screen.getByText(en.event.addTitle)).toBeTruthy();
    held.release();
    await waitFor(() => expect(screen.queryByText(en.event.addTitle)).toBeNull());
  } finally {
    held.restore();
  }
});

test('tapping confirm twice uploads the file once', async () => {
  const fake = await open();
  await choosePhotos(1);
  await screen.findByText(en.event.documents.photo(1));
  await press(en.event.save);
  const confirm = await screen.findByRole('button', { name: en.event.check.confirm });
  await fireEvent.press(confirm);
  await fireEvent.press(confirm);
  await waitFor(() => expect(fake.callsTo('addAttachment')).toHaveLength(1));
  expect(fake.callsTo('addEvent')).toHaveLength(1);
  expect(fake.callsTo('addAttachment')).toHaveLength(1);
});
