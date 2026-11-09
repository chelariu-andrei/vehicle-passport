import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { currentAuthPort } from '../auth/authPort';

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Writes downloaded bytes to the cache directory and opens the system share sheet. */
export async function saveAndShare(bytes: ArrayBuffer, contentType: string, baseName: string): Promise<void> {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  const safeName = baseName.replace(/[^A-Za-z0-9._-]/g, '_');
  const file = new File(Paths.cache, `${safeName}.${EXTENSIONS[mime] ?? 'bin'}`);
  file.create({ overwrite: true });
  await file.write(new Uint8Array(bytes));
  await Sharing.shareAsync(file.uri, { mimeType: mime });
}

/** For image components that fetch by URL themselves (QR). */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await currentAuthPort.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
