import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { CarViewer } from './CarViewer';

let mockEnabled = true;
let mockProps: { onMessage: (event: { nativeEvent: { data: string } }) => void } | null = null;
const mockPost = jest.fn();

jest.mock('./config', () => ({
  get CAR_VIEWER_ENABLED() {
    return mockEnabled;
  },
  VIEWER_COLOURS: [],
}));

jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: async () => ({ localUri: 'file:///viewer.html', uri: 'file:///viewer.html' }) }),
  },
}));

jest.mock('../../../assets/viewer/viewer.html', () => 1, { virtual: true });

/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef(function WebViewStub(props: never, ref: never) {
    React.useImperativeHandle(ref, () => ({ postMessage: mockPost }));
    mockProps = props;
    return React.createElement(View, { testID: 'car-webview' });
  });
  return { WebView, default: WebView };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const sent = () => mockPost.mock.calls.map(([raw]) => JSON.parse(raw as string));
const fromViewer = (message: object) =>
  act(() => {
    mockProps?.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  });

let appStateHandler: ((state: AppStateStatus) => void) | null = null;
let reduceMotion = false;

beforeEach(() => {
  mockEnabled = true;
  mockProps = null;
  mockPost.mockClear();
  appStateHandler = null;
  reduceMotion = false;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: (state: AppStateStatus) => void) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(async () => reduceMotion);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((() => ({ remove: jest.fn() })) as never);
});

afterEach(() => jest.restoreAllMocks());

async function mountReady(props: { color?: string; active?: boolean } = {}) {
  const view = await render(<CarViewer color={props.color ?? '#0f1a15'} active={props.active ?? true} />);
  await screen.findByTestId('car-webview');
  await fromViewer({ type: 'ready' });
  return view;
}

test('shows the placeholder until ready, then hides it', async () => {
  await render(<CarViewer color="#0f1a15" active />);
  await screen.findByTestId('car-webview');
  expect(screen.getByTestId('stage-placeholder')).toBeTruthy();
  await fromViewer({ type: 'ready' });
  expect(screen.queryByTestId('stage-placeholder')).toBeNull();
});

test('keeps the placeholder on error', async () => {
  await render(<CarViewer color="#0f1a15" active />);
  await screen.findByTestId('car-webview');
  await fromViewer({ type: 'error' });
  expect(screen.getByTestId('stage-placeholder')).toBeTruthy();
});

test('puts the placeholder back if an error follows ready', async () => {
  await mountReady();
  await fromViewer({ type: 'error' });
  expect(screen.getByTestId('stage-placeholder')).toBeTruthy();
});

test('sends setColor when the colour changes', async () => {
  const view = await mountReady();
  await view.rerender(<CarViewer color="#a3171d" active />);
  expect(sent()).toContainEqual({ type: 'setColor', hex: '#a3171d' });
});

test('sends pause when active becomes false, resume when true', async () => {
  const view = await mountReady();
  await view.rerender(<CarViewer color="#0f1a15" active={false} />);
  expect(sent().at(-1)).toEqual({ type: 'pause' });
  await view.rerender(<CarViewer color="#0f1a15" active />);
  expect(sent().at(-1)).toEqual({ type: 'resume' });
});

test('sends pause when the app goes to the background, resume when it returns', async () => {
  await mountReady();
  await act(() => appStateHandler?.('background'));
  expect(sent().at(-1)).toEqual({ type: 'pause' });
  await act(() => appStateHandler?.('active'));
  expect(sent().at(-1)).toEqual({ type: 'resume' });
});

test('stays paused when the app returns but the screen is inactive', async () => {
  await mountReady({ active: false });
  await act(() => appStateHandler?.('background'));
  await act(() => appStateHandler?.('active'));
  expect(sent().at(-1)).toEqual({ type: 'pause' });
});

test('sends setReduceMotion true when the OS asks for reduced motion', async () => {
  reduceMotion = true;
  await mountReady();
  expect(sent()).toContainEqual({ type: 'setReduceMotion', value: true });
});

test('reports fps to the caller', async () => {
  const onFps = jest.fn();
  await render(<CarViewer color="#0f1a15" active onFps={onFps} />);
  await screen.findByTestId('car-webview');
  await fromViewer({ type: 'fps', value: 58 });
  expect(onFps).toHaveBeenCalledWith(58);
});

test('renders only the placeholder when CAR_VIEWER_ENABLED is false', async () => {
  mockEnabled = false;
  await render(<CarViewer color="#0f1a15" active />);
  expect(screen.getByTestId('stage-placeholder')).toBeTruthy();
  expect(screen.queryByTestId('car-webview')).toBeNull();
});
