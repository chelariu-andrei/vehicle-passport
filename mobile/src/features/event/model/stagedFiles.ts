import { MAX_UPLOAD_BYTES } from '@/features/scan';

import type { PreparedFile } from './preparedFile';

/** A file the person has chosen for an event that is not saved yet. */
export type StagedFile = PreparedFile & { name: string; kind: 'photo' | 'pdf' };

export const MAX_STAGED = 10;

/** Adds what was picked, up to `max` files in all; `overflow` says some of it did not fit. */
export function addStaged(list: StagedFile[], picked: StagedFile[], max = MAX_STAGED): { list: StagedFile[]; overflow: boolean } {
  const room = Math.max(0, max - list.length);
  return { list: [...list, ...picked.slice(0, room)], overflow: picked.length > room };
}

export function removeStaged(list: StagedFile[], index: number): StagedFile[] {
  return list.filter((_, i) => i !== index);
}

/** The key (under `en.event.documents`) of why a picked PDF cannot be attached, or null when it can. PDFs are sent as they are, so the size is checked here. */
export function pdfProblem(size: number): 'tooLarge' | null {
  return size > MAX_UPLOAD_BYTES ? 'tooLarge' : null;
}
