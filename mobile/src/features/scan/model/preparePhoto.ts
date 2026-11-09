import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { deleteKeptFile } from './scanJobStore';

export const MAX_UPLOAD_BYTES = 10_485_760;
export const MAX_LONG_EDGE = 4096;
export const MAX_PHOTOS = 20;
const QUALITIES = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4];

/** A JPEG in the document directory, ready to upload and safe to keep for a retry. */
export type PreparedPhoto = { uri: string; size: number };

/** The photo cannot be turned into an acceptable JPEG: it cannot be decoded, or is too large even at the lowest quality. */
export class PhotoUnusableError extends Error {
  constructor(message = 'The photo cannot be used') {
    super(message);
    this.name = 'PhotoUnusableError';
  }
}

/**
 * Re-encodes any picked photo (HEIC included) as JPEG with the long edge at most 4096 px and at most 10 MB, and moves
 * it to the document directory so it outlives the cache (integration 3.4.1).
 */
export async function preparePhoto(asset: { uri: string; width: number; height: number }): Promise<PreparedPhoto> {
  const longEdge = Math.max(asset.width, asset.height);
  // Only decoding and re-encoding failures mean "this photo is unusable"; anything else is a bug and must surface.
  const unusable = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch {
      throw new PhotoUnusableError();
    }
  };

  const image = await unusable(() => {
    let context = ImageManipulator.manipulate(asset.uri);
    if (longEdge > MAX_LONG_EDGE) {
      context = context.resize(asset.width >= asset.height ? { width: MAX_LONG_EDGE } : { height: MAX_LONG_EDGE });
    }
    return context.renderAsync();
  });
  for (const compress of QUALITIES) {
    const saved = await unusable(() => image.saveAsync({ format: SaveFormat.JPEG, compress }));
    const attempt = new File(saved.uri);
    const size = attempt.size;
    if (size > MAX_UPLOAD_BYTES) {
      deleteKeptFile(saved.uri);
      continue;
    }
    const kept = new File(Paths.document, `scan-${randomUUID()}.jpg`);
    attempt.move(kept);
    return { uri: kept.uri, size };
  }
  throw new PhotoUnusableError('The photo is too large even at the lowest quality');
}
