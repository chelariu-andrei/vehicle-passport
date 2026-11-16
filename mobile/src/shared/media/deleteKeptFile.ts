import { File } from 'expo-file-system';

/** Deletes a kept photo. Never throws: a missing file is already what we want. */
export function deleteKeptFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The file is already gone or unreachable; the row is removed regardless.
  }
}
