import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { fakeAuth } from '../../../test/fakes/auth';
import { authHeaders, saveAndShare } from './binary';

const written = (File as unknown as { written: { uri: string; data: unknown }[] }).written;

beforeEach(() => {
  written.length = 0;
  jest.clearAllMocks();
});

test('saveAndShare writes the bytes with an extension matching the content type and opens the share sheet', async () => {
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  await saveAndShare(bytes, 'application/pdf', 'passport-WVW');
  expect(written).toHaveLength(1);
  expect(written[0].uri).toBe('cache/passport-WVW.pdf');
  expect(new Uint8Array(written[0].data as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
  expect(Sharing.shareAsync).toHaveBeenCalledWith('cache/passport-WVW.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));

  await saveAndShare(bytes, 'image/png', 'invoice');
  expect(written[1].uri).toBe('cache/invoice.png');
});

test('a base name cannot escape the cache directory', async () => {
  await saveAndShare(new ArrayBuffer(1), 'image/jpeg', '../evil name');
  expect(written[0].uri).toBe('cache/.._evil_name.jpg');
});

test('authHeaders carries the current bearer token, or nothing when signed out', async () => {
  expect(await authHeaders()).toEqual({ Authorization: `Bearer ${fakeAuth.token}` });
  await fakeAuth.port.signOutLocal();
  expect(await authHeaders()).toEqual({});
});
