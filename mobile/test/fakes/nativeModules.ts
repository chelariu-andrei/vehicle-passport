/* Native module fakes. Each stub is a jest.fn so tests can configure it. */
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

/* The native UUID generator is not there under Node; everything else keeps its real implementation. */
jest.mock('expo-crypto', () => ({
  __esModule: true,
  ...jest.requireActual('expo-crypto'),
  randomUUID: () => require('node:crypto').randomUUID(),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

/* The real module builds a Supabase client on encrypted storage; tests talk to the scriptable fake instead. */
jest.mock('@/shared/auth/supabase', () => ({ supabase: require('./auth').supabaseFake }));

/* Camera, library and image manipulator are scripted through ./photos (setup.ts resets them before every test). */
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => require('./photos').imageManipulatorModule);

/* A device file system in memory: `sizes` holds the files that exist, `removed` the ones that vanished, `deleted` what the app deleted. */
jest.mock('expo-file-system', () => {
  const MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' };
  class File extends Blob {
    uri: string;
    name: string;
    static written: { uri: string; data: unknown }[] = [];
    static sizes = new Map<string, number>();
    static removed = new Set<string>();
    static deleted: string[] = [];
    constructor(...parts: unknown[]) {
      super([]);
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
      this.name = this.uri.split('/').pop() ?? this.uri;
    }
    get type(): string {
      return MIME[this.name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
    }
    get size(): number {
      return File.sizes.get(this.uri) ?? 0;
    }
    get exists(): boolean {
      return !File.removed.has(this.uri);
    }
    create = jest.fn();
    write = jest.fn(async (data: unknown) => {
      File.written.push({ uri: this.uri, data });
    });
    copy = jest.fn();
    /** Like the real one: the file is now at the destination. */
    move = jest.fn((destination: File) => {
      File.sizes.set(destination.uri, this.size);
      File.removed.delete(destination.uri);
      File.sizes.delete(this.uri);
      this.uri = destination.uri;
    });
    delete = jest.fn(() => {
      File.deleted.push(this.uri);
      File.removed.add(this.uri);
      File.sizes.delete(this.uri);
    });
  }
  return { File, Paths: { cache: 'cache', document: 'document' } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })),
}));

/* A host element, so a test reads its props (`source`, `cachePolicy`) and fires `onError` as the native image would. */
jest.mock('expo-image', () => ({ Image: 'Image' }));

/* The system date picker is a host element, so a test reads its props (`maximumDate`) and fires `onChange` as the picker would. */
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
  default: 'WebView',
}));
