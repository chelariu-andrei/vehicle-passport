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
  getRandomBytes: (count: number) => new Uint8Array(require('node:crypto').randomBytes(count)),
  digestStringAsync: async (_algorithm: string, data: string) =>
    require('node:crypto').createHash('sha256').update(data).digest('hex'),
}));

/* Sign in with Apple and Google: tests script signInAsync / signIn. */
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(async () => true), signIn: jest.fn() },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
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

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

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
      // Only what a test put there (`putFile`) or the app wrote exists; a path nobody touched holds nothing.
      return !File.removed.has(this.uri) && (File.sizes.has(this.uri) || File.written.some((w) => w.uri === this.uri));
    }
    create = jest.fn();
    write = jest.fn(async (data: unknown) => {
      File.written.push({ uri: this.uri, data });
    });
    /** Like the real one: the destination now holds the same bytes. */
    copy = jest.fn((destination: File) => {
      File.sizes.set(destination.uri, this.size);
      File.removed.delete(destination.uri);
    });
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
