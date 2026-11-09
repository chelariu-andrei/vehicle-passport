import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import { deletedFiles, manipulator } from '../../../../test/fakes/photos';
import { MAX_UPLOAD_BYTES, PhotoUnusableError, preparePhoto } from './preparePhoto';

const photo = (width: number, height: number) => ({ uri: 'file:///photos/a.heic', width, height });

test('12000×9000 is resized to long edge 4096', async () => {
  await preparePhoto(photo(12000, 9000));
  expect(manipulator.resizes).toEqual([{ width: 4096 }]);
});

test('a portrait 9000×12000 is resized by height', async () => {
  await preparePhoto(photo(9000, 12000));
  expect(manipulator.resizes).toEqual([{ height: 4096 }]);
});

test('a 1000×800 photo is not upscaled', async () => {
  await preparePhoto(photo(1000, 800));
  expect(manipulator.resizes).toEqual([]);
  expect(manipulator.sources).toEqual(['file:///photos/a.heic']);
});

test('quality steps 0.9, 0.8, 0.7, 0.6, 0.5, 0.4 until ≤ 10 485 760 bytes', async () => {
  manipulator.sizeAt = (q) => (q > 0.45 ? MAX_UPLOAD_BYTES + 1 : MAX_UPLOAD_BYTES);
  const result = await preparePhoto(photo(4000, 3000));
  expect(manipulator.saves.map((s) => s.compress)).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]);
  expect(result.size).toBe(MAX_UPLOAD_BYTES);
});

test('stops at the first quality that fits', async () => {
  manipulator.sizeAt = (q) => (q > 0.85 ? MAX_UPLOAD_BYTES + 1 : 1000);
  await preparePhoto(photo(4000, 3000));
  expect(manipulator.saves.map((s) => s.compress)).toEqual([0.9, 0.8]);
});

test('throws PhotoUnusableError when 0.4 is still too large, and leaves no file behind', async () => {
  manipulator.sizeAt = () => MAX_UPLOAD_BYTES + 1;
  await expect(preparePhoto(photo(4000, 3000))).rejects.toBeInstanceOf(PhotoUnusableError);
  expect(manipulator.saves).toHaveLength(6);
  expect(deletedFiles()).toHaveLength(6);
});

test('a photo that cannot be decoded is unusable', async () => {
  manipulator.failFor = () => true;
  await expect(preparePhoto(photo(4000, 3000))).rejects.toBeInstanceOf(PhotoUnusableError);
});

test('a programming error is not reported as an unusable photo', async () => {
  jest.spyOn(Crypto, 'randomUUID').mockImplementationOnce(() => {
    throw new TypeError('randomUUID is not available');
  });
  const result = preparePhoto(photo(1000, 800));
  await expect(result).rejects.toBeInstanceOf(TypeError);
  await expect(result).rejects.not.toBeInstanceOf(PhotoUnusableError);
});

test('the kept file name comes from expo-crypto, not a global', async () => {
  jest.spyOn(Crypto, 'randomUUID').mockReturnValueOnce('11111111-1111-4111-8111-111111111111');
  const result = await preparePhoto(photo(1000, 800));
  expect(result.uri).toBe('document/scan-11111111-1111-4111-8111-111111111111.jpg');
});

test('output is always JPEG and lives in the document directory', async () => {
  const result = await preparePhoto(photo(1000, 800));
  expect(manipulator.saves.every((s) => s.format === 'jpeg')).toBe(true);
  expect(result.uri).toMatch(/^document\/.+\.jpg$/);
  expect(new File(result.uri).size).toBe(result.size);
});
