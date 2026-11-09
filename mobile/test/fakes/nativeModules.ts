/* Native module fakes. Each stub is a jest.fn so tests can configure it. */
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

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

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
}));

jest.mock('expo-file-system', () => {
  class File extends Blob {
    uri: string;
    name: string;
    type: string;
    exists = true;
    constructor(...parts: unknown[]) {
      super([]);
      const last = String(parts[parts.length - 1] ?? '');
      this.uri = parts.map(String).join('/');
      this.name = last.split('/').pop() ?? last;
      this.type = 'application/octet-stream';
    }
    get size(): number {
      return 0;
    }
    static written: { uri: string; data: unknown }[] = [];
    create = jest.fn();
    write = jest.fn(async (data: unknown) => {
      File.written.push({ uri: this.uri, data });
    });
    copy = jest.fn();
    delete = jest.fn();
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
