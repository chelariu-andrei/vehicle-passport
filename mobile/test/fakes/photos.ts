/* Scriptable stand-ins for the camera, the photo library and the image manipulator. Wired in by nativeModules.ts. */
/* eslint-disable @typescript-eslint/no-require-imports -- the mocked modules are read lazily so this file can be loaded by the mock factories */
import * as ImagePicker from 'expo-image-picker';

type Resize = { width?: number; height?: number };
type Save = { compress?: number; format?: string };

/** What the fake manipulator was asked to do, and what it answers. */
export const manipulator = {
  resizes: [] as Resize[],
  saves: [] as Save[],
  sources: [] as string[],
  /** Size in bytes of a JPEG saved at this compression quality. */
  sizeAt: (_quality: number): number => 200_000,
  /** Sources the manipulator cannot decode. */
  failFor: (_uri: string): boolean => false,
  counter: 0,
  reset() {
    this.resizes = [];
    this.saves = [];
    this.sources = [];
    this.sizeAt = () => 200_000;
    this.failFor = () => false;
    this.counter = 0;
  },
};

type FakeFile = { sizes: Map<string, number> };
const fakeFiles = () => (require('expo-file-system') as { File: unknown }).File as FakeFile;

/** The module `expo-image-manipulator` is replaced with. Mirrors the object API (`manipulate(...).resize(...).renderAsync()`). */
export const imageManipulatorModule = {
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      manipulator.sources.push(uri);
      const context = {
        resize(size: Resize) {
          manipulator.resizes.push(size);
          return context;
        },
        async renderAsync() {
          if (manipulator.failFor(uri)) throw new Error('The image could not be decoded');
          return {
            width: 0,
            height: 0,
            async saveAsync(options: Save = {}) {
              manipulator.saves.push(options);
              const out = `cache/manipulated-${++manipulator.counter}.jpg`;
              fakeFiles().sizes.set(out, manipulator.sizeAt(options.compress ?? 1));
              return { uri: out, width: 0, height: 0 };
            },
          };
        },
      };
      return context;
    },
  },
};

export type PickedAsset = { uri: string; width: number; height: number };
let assetCounter = 0;

/** A picked photo as `expo-image-picker` reports it. */
export function anAsset(o: Partial<PickedAsset> = {}): PickedAsset {
  return { uri: `file:///photos/IMG_${++assetCounter}.jpg`, width: 3000, height: 2000, ...o };
}

/** The next camera or library launch returns these photos. */
export const picked = (...assets: PickedAsset[]) => ({ canceled: false as const, assets });

const cancelled = { canceled: true as const, assets: null };
const granted = { granted: true, canAskAgain: true, status: 'granted' as ImagePicker.PermissionStatus, expires: 'never' as const };

/** Back to: nothing picked, permissions granted. Called before every test. */
export function resetPhotoFakes(): void {
  manipulator.reset();
  const mocks = [
    ImagePicker.launchCameraAsync,
    ImagePicker.launchImageLibraryAsync,
    ImagePicker.requestCameraPermissionsAsync,
  ] as jest.Mock[];
  mocks.forEach((mock) => mock.mockReset());
  jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue(cancelled);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(cancelled);
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue(granted);
}

/** A device file the app can find (or, with `size` 0, an empty one). */
export function putFile(uri: string, size = 150_000): void {
  const files = fakeFiles() as unknown as { sizes: Map<string, number>; removed: Set<string> };
  files.sizes.set(uri, size);
  files.removed.delete(uri);
}

/** The device file is gone, as if the system cleared it. */
export function loseFile(uri: string): void {
  (fakeFiles() as unknown as { removed: Set<string> }).removed.add(uri);
}

/** Uris of files the app deleted. */
export const deletedFiles = (): string[] => (require('expo-file-system').File as { deleted: string[] }).deleted;

export function resetFiles(): void {
  const files = fakeFiles() as unknown as { sizes: Map<string, number>; removed: Set<string>; deleted: string[] };
  files.sizes.clear();
  files.removed.clear();
  files.deleted.length = 0;
}
