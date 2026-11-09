import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { scanJobStore } from '@/features/scan';
import type { LocalScanJob } from '@/features/scan';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { anAsset, deletedFiles, manipulator, picked, putFile } from '../fakes/photos';
import type { FakeApi } from '../fake-api';
import { aScanJob, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
jest.setTimeout(20000);
const feature = loadFeature('../../features/scanner.feature', { loadRelativePath: true });

const MAX_UPLOAD_BYTES = 10_485_760;
const me = () => fakeAuth.userId!;
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const withCar = (api: FakeApi) => void api.state.vehicles.push(aVehicle());

beforeEach(async () => {
  await AsyncStorage.clear();
});

const camera = () => jest.mocked(ImagePicker.launchCameraAsync);
const library = () => jest.mocked(ImagePicker.launchImageLibraryAsync);

async function openCapture() {
  return openApp(`/scans/new?vin=${SAMPLE_VIN}`, { seed: withCar });
}

/** Takes the photos with the camera, one at a time, then uploads. */
async function takeAndUpload(...assets: ReturnType<typeof anAsset>[]) {
  for (const asset of assets) {
    camera().mockResolvedValueOnce(picked(asset));
    await press(en.scans.takePhoto);
    await waitFor(() => expect(screen.getByLabelText(en.scans.removePhoto(assets.indexOf(asset) + 1))).toBeTruthy());
  }
  await press(en.scans.upload(assets.length));
}

async function seedJob(status: NonNullable<Parameters<typeof aScanJob>[0]>['status'], opts: { seedCar?: boolean } = {}) {
  const job = aScanJob({ status });
  const local: LocalScanJob = {
    jobId: job.id,
    vin: SAMPLE_VIN,
    localUri: `document/${job.id}.jpg`,
    submittedAt: '2025-01-15T10:00:00Z',
    batchId: null,
  };
  putFile(local.localUri);
  await scanJobStore.add(me(), [local]);
  return {
    job,
    local,
    seed: (api: FakeApi) => {
      if (opts.seedCar !== false) withCar(api);
      api.state.scans[job.id] = job;
    },
  };
}

defineFeature(feature, (test) => {
  let fake: FakeApi;

  test('A HEIC photo is converted', ({ when, then }) => {
    when('I pick a HEIC photo', async () => {
      fake = await openCapture();
      await takeAndUpload(anAsset({ uri: 'file:///photos/IMG_0001.heic', width: 4032, height: 3024 }));
      await waitFor(() => expect(fake.callsTo('submitScan')).toHaveLength(1));
    });
    then('the upload is a JPEG under 10 MB', async () => {
      expect(manipulator.sources).toEqual(['file:///photos/IMG_0001.heic']);
      expect(manipulator.saves.every((s) => s.format === 'jpeg')).toBe(true);
      const [part] = fake.callsTo('submitScan')[0].parts;
      expect(part.type).toBe('image/jpeg');
      const [stored] = await scanJobStore.list(me());
      expect(stored.localUri).toMatch(/\.jpg$/);
      const size = new File(stored.localUri).size;
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
    });
  });

  test('Large photos are reduced before upload', ({ when, then }) => {
    when('I pick a 12000 by 9000 pixel photo', async () => {
      fake = await openCapture();
      await takeAndUpload(anAsset({ width: 12000, height: 9000 }));
      await waitFor(() => expect(fake.callsTo('submitScan')).toHaveLength(1));
    });
    then("the upload's long edge is at most 4096 px", () => {
      expect(manipulator.resizes).toEqual([{ width: 4096 }]);
    });
  });

  test('The batch limit is enforced on the device', ({ when, then }) => {
    when('I try to add a 21st photo', async () => {
      await openCapture();
      library().mockResolvedValueOnce(picked(...Array.from({ length: 20 }, () => anAsset())));
      await press(en.scans.choosePhotos);
      await waitFor(() => expect(screen.getByLabelText(en.scans.removePhoto(20))).toBeTruthy());
      camera().mockResolvedValueOnce(picked(anAsset()));
      await press(en.scans.takePhoto);
    });
    then('it is not added and I am told the limit is 20', async () => {
      expect(await screen.findByText(en.scans.limit)).toBeTruthy();
      expect(screen.queryByLabelText(en.scans.removePhoto(21))).toBeNull();
      expect(camera()).not.toHaveBeenCalled();
    });
  });

  test('PDFs are not offered', ({ when, then }) => {
    when('I open capture', async () => {
      await openCapture();
      expect(await screen.findByText(en.scans.onePhoto)).toBeTruthy();
    });
    then('I can only take or choose photos', async () => {
      expect(screen.getByRole('button', { name: en.scans.takePhoto })).toBeTruthy();
      expect(screen.getByRole('button', { name: en.scans.choosePhotos })).toBeTruthy();
      expect(screen.queryAllByRole('button')).toHaveLength(2);
      await press(en.scans.choosePhotos);
      await press(en.scans.takePhoto);
      expect(library().mock.calls[0][0]).toMatchObject({ mediaTypes: ['images'] });
      expect(camera().mock.calls[0][0]).toMatchObject({ mediaTypes: ['images'] });
    });
  });

  test('Scans survive an app restart', ({ given, when, then }) => {
    let seeded: Awaited<ReturnType<typeof seedJob>>;
    given('a job is PROCESSING', async () => {
      // Submitted before the app was closed: only the device store remembers it.
      seeded = await seedJob('PROCESSING');
    });
    when('I restart the app', async () => {
      // A cold start: no query cache, nothing in memory, only the store on the device and the server.
      fake = await openApp('/scans', { seed: seeded.seed });
    });
    then('the job is still in my inbox and keeps updating', async () => {
      expect(await screen.findByText(en.scans.status.reading)).toBeTruthy();
      fake.state.scans[seeded.job.id].status = 'EXTRACTED';
      expect(await screen.findByText(en.scans.status.ready, {}, { timeout: 8000 })).toBeTruthy();
    });
  });

  test('One photo is one job', ({ when, then }) => {
    when('I upload one photo', async () => {
      fake = await openCapture();
      await takeAndUpload(anAsset());
    });
    then(/^a single scan is requested with part "(.*)"$/, async (field: string) => {
      await waitFor(() => expect(fake.callsTo('submitScan')).toHaveLength(1));
      expect(fake.callsTo('submitScan')[0].parts.map((p) => p.field)).toEqual([field]);
      expect(fake.callsTo('submitScanBatch')).toHaveLength(0);
    });
  });

  test('Several photos are one batch', ({ when, then, and }) => {
    when('I upload three photos', async () => {
      fake = await openCapture();
      await takeAndUpload(anAsset(), anAsset(), anAsset());
    });
    then(/^one batch is requested with three "(.*)" parts$/, async (field: string) => {
      await waitFor(() => expect(fake.callsTo('submitScanBatch')).toHaveLength(1));
      expect(fake.callsTo('submitScanBatch')[0].parts.map((p) => p.field)).toEqual([field, field, field]);
      expect(fake.callsTo('submitScan')).toHaveLength(0);
    });
    and('my inbox has three rows, each with its own photo', async () => {
      await waitFor(() => expect(screen.getAllByText(en.scans.status.reading)).toHaveLength(3));
      const jobs = await scanJobStore.list(me());
      expect(new Set(jobs.map((j) => j.localUri)).size).toBe(3);
      // The server keeps file order, so job i belongs to part i.
      const names = fake.callsTo('submitScanBatch')[0].parts.map((p) => p.name);
      expect(jobs.map((j) => j.localUri.split('/').pop())).toEqual(names);
      expect(new Set(jobs.map((j) => j.batchId)).size).toBe(1);
      expect(jobs[0].batchId).not.toBeNull();
    });
  });

  test('A bad photo is named before anything is sent', ({ given, when, then, and }) => {
    given('the second of three photos cannot be prepared', async () => {
      fake = await openCapture();
      manipulator.failFor = (uri) => uri.includes('corrupt');
      camera()
        .mockResolvedValueOnce(picked(anAsset()))
        .mockResolvedValueOnce(picked(anAsset({ uri: 'file:///photos/corrupt.jpg' })))
        .mockResolvedValueOnce(picked(anAsset()));
      for (let i = 1; i <= 3; i++) {
        await press(en.scans.takePhoto);
        await waitFor(() => expect(screen.getByLabelText(en.scans.removePhoto(i))).toBeTruthy());
      }
    });
    when('I upload them', async () => {
      await press(en.scans.upload(3));
    });
    then('I am told which photo is the problem', async () => {
      expect(await screen.findByText(en.scans.badPhoto(2))).toBeTruthy();
    });
    and('no request is sent', () => {
      expect(fake.callsTo('submitScan')).toHaveLength(0);
      expect(fake.callsTo('submitScanBatch')).toHaveLength(0);
      // The first photo had been prepared already; it must not be left on the device.
      expect(deletedFiles()).toHaveLength(1);
    });
  });

  test('A failed scan can be retried from the kept photo', ({ given, when, then }) => {
    let seeded: Awaited<ReturnType<typeof seedJob>>;
    given('a job is FAILED', async () => {
      seeded = await seedJob('FAILED');
      fake = await openApp('/scans', { seed: seeded.seed });
      expect(await screen.findByText(en.scans.status.failed)).toBeTruthy();
    });
    when('I choose Retry', async () => {
      await press(en.scans.retry);
    });
    then('a new job replaces the old row', async () => {
      await waitFor(() => expect(fake.callsTo('submitScan')).toHaveLength(1));
      expect(fake.callsTo('submitScan')[0].parts[0].name).toBe(`${seeded.job.id}.jpg`);
      expect(await screen.findByText(en.scans.status.reading)).toBeTruthy();
      expect(screen.queryByText(en.scans.status.failed)).toBeNull();
      const jobs = await scanJobStore.list(me());
      expect(jobs).toHaveLength(1);
      expect(jobs[0].jobId).not.toBe(seeded.job.id);
      expect(jobs[0].localUri).toBe(seeded.local.localUri);
      expect(deletedFiles()).toEqual([]);
    });
  });

  test('A cancelled scan explains itself', ({ given, then }) => {
    given('a job is CANCELLED', async () => {
      const seeded = await seedJob('CANCELLED');
      fake = await openApp('/scans', { seed: seeded.seed });
    });
    then(/^I see "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.getByRole('button', { name: en.scans.dismiss })).toBeTruthy();
    });
  });

  test('An orphaned job is dropped', ({ when, then }) => {
    when(/^polling a job answers (\d+) "(.*)"$/, async (status: string, code: string) => {
      const seeded = await seedJob('PROCESSING');
      fake = await openApp('/scans', {
        seed: (api) => {
          seeded.seed(api);
          api.failNext('getScan', Number(status), code);
        },
      });
    });
    then('its row is removed', async () => {
      await waitFor(async () => expect(await scanJobStore.list(me())).toEqual([]));
      await waitFor(() => expect(screen.queryByText(en.scans.status.reading)).toBeNull());
      expect(deletedFiles()).toHaveLength(1);
    });
  });

  test('No car to scan for', ({ given, when, then }) => {
    given('I have no cars', async () => {
      fake = await openApp('/scans');
      expect(await screen.findByText(en.scans.emptyTitle)).toBeTruthy();
    });
    when('I start a scan', async () => {
      await press(en.scans.scanInvoice);
    });
    then('I am told to add a car first and offered Add vehicle', async () => {
      expect(await screen.findByText(en.scans.needCarTitle)).toBeTruthy();
      await press(en.garage.addVehicle);
      await waitFor(() => expect(screen).toHavePathname('/vehicles/new'));
    });
  });

  test('The one-photo rule is stated', ({ when, then }) => {
    when('I open capture', async () => {
      await openCapture();
    });
    then(/^I see "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
    });
  });

  test('One car skips the car picker', ({ given, when, then }) => {
    given('I have one car', async () => {
      fake = await openApp('/scans', { seed: withCar });
      expect(await screen.findByText(en.scans.emptyTitle)).toBeTruthy();
    });
    when('I start a scan', async () => {
      await press(en.scans.scanInvoice);
    });
    then('I go straight to capture', async () => {
      expect(await screen.findByText(en.scans.onePhoto)).toBeTruthy();
      expect(screen.queryByText(en.scans.pickCar)).toBeNull();
    });
  });

  test('Camera access refused', ({ given, when, then }) => {
    given('camera permission is denied', async () => {
      jest
        .mocked(ImagePicker.requestCameraPermissionsAsync)
        .mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied', expires: 'never' } as never);
      await openCapture();
    });
    when('I choose Take photo', async () => {
      await press(en.scans.takePhoto);
    });
    then('I am told how to allow it', async () => {
      expect(await screen.findByText(en.scans.cameraDenied)).toBeTruthy();
      expect(camera()).not.toHaveBeenCalled();
    });
  });
});
