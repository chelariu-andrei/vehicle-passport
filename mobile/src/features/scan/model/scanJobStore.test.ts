import AsyncStorage from '@react-native-async-storage/async-storage';

import { deletedFiles, putFile } from '../../../../test/fakes/photos';
import { scanJobStore } from './scanJobStore';
import type { LocalScanJob } from './scanJobStore';

const job = (jobId: string, o: Partial<LocalScanJob> = {}): LocalScanJob => ({
  jobId,
  vin: 'WVWZZZ1JZXW000001',
  localUri: `document/${jobId}.jpg`,
  submittedAt: '2025-01-15T10:00:00Z',
  batchId: null,
  ...o,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('isolated by user id', async () => {
  await scanJobStore.add('u1', [job('a')]);
  expect(await scanJobStore.list('u2')).toEqual([]);
  await scanJobStore.remove('u2', 'a');
  expect(await scanJobStore.list('u1')).toHaveLength(1);
});

test('add keeps order and ignores a job id already stored', async () => {
  await scanJobStore.add('u1', [job('a'), job('b')]);
  await scanJobStore.add('u1', [job('a'), job('c')]);
  expect((await scanJobStore.list('u1')).map((j) => j.jobId)).toEqual(['a', 'b', 'c']);
});

test('remove deletes the local file', async () => {
  putFile('document/a.jpg');
  await scanJobStore.add('u1', [job('a')]);
  await scanJobStore.remove('u1', 'a');
  expect(await scanJobStore.list('u1')).toEqual([]);
  expect(deletedFiles()).toEqual(['document/a.jpg']);
});

test('replace swaps the job in place and keeps the photo', async () => {
  await scanJobStore.add('u1', [job('a'), job('b')]);
  await scanJobStore.replace('u1', 'a', job('c', { localUri: 'document/a.jpg' }));
  expect((await scanJobStore.list('u1')).map((j) => j.jobId)).toEqual(['c', 'b']);
  expect(deletedFiles()).toEqual([]);
});

test('survives a new store instance', async () => {
  await scanJobStore.add('u1', [job('a')]);
  let fresh!: typeof scanJobStore;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module instance is the point
    fresh = require('./scanJobStore').scanJobStore;
  });
  expect((await fresh.list('u1')).map((j) => j.jobId)).toEqual(['a']);
});

test('unreadable stored data counts as no jobs', async () => {
  await AsyncStorage.setItem('scans:u1', '{not json');
  expect(await scanJobStore.list('u1')).toEqual([]);
  await AsyncStorage.setItem('scans:u1', JSON.stringify([{ jobId: 3 }, job('a')]));
  expect((await scanJobStore.list('u1')).map((j) => j.jobId)).toEqual(['a']);
});
