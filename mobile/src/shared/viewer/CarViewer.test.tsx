import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';

import { tokens } from '@/shared/design';

import { CarViewer } from './CarViewer';
import { NEUTRAL_LOOK, type Look } from './look';

const RED: Look = { ...NEUTRAL_LOOK, bodyType: 'SUV', color: 'RED', colorHex: null };

let mockEnabled = true;
let mockProps: { onMessage: (event: { nativeEvent: { data: string } }) => void } | null = null;
const mockPost = jest.fn();

jest.mock('./config', () => ({
  get CAR_VIEWER_ENABLED() {
    return mockEnabled;
  },
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

async function mountReady(props: { look?: Look; active?: boolean } = {}) {
  const view = await render(<CarViewer look={props.look ?? NEUTRAL_LOOK} active={props.active ?? true} />);
  await screen.findByTestId('car-webview');
  await fromViewer({ type: 'ready' });
  return view;
}

test('shows the silhouette until the viewer is ready', async () => {
  await render(<CarViewer look={NEUTRAL_LOOK} active />);
  await screen.findByTestId('car-webview');
  expect(screen.getByTestId('car-silhouette')).toBeTruthy();
  await fromViewer({ type: 'ready' });
  expect(screen.queryByTestId('car-silhouette')).toBeNull();
});

test('falls back to the silhouette on error and stays there', async () => {
  await mountReady();
  await fromViewer({ type: 'error' });
  expect(screen.getByTestId('car-silhouette')).toBeTruthy();
  expect(screen.queryByTestId('car-webview')).toBeNull();
});

test('sends the look once ready, and again when it changes', async () => {
  const view = await mountReady();
  expect(sent()).toContainEqual({ type: 'setLook', look: NEUTRAL_LOOK });
  await view.rerender(<CarViewer look={RED} active />);
  expect(sent()).toContainEqual({ type: 'setLook', look: RED });
});

test('sends turnTo when the view prop changes', async () => {
  const view = await mountReady();
  await view.rerender(<CarViewer look={NEUTRAL_LOOK} view="rear" active />);
  expect(sent()).toContainEqual({ type: 'turnTo', view: 'rear' });
});

test('sends the theme colours once ready', async () => {
  await mountReady();
  const { dark } = tokens.color;
  expect(sent()).toContainEqual({ type: 'setColors', floor: dark.bg, tick: dark['ink-muted'], mark: dark.brand });
});

test('sends pause when active becomes false, resume when true', async () => {
  const view = await mountReady();
  await view.rerender(<CarViewer look={NEUTRAL_LOOK} active={false} />);
  expect(sent().at(-1)).toEqual({ type: 'pause' });
  await view.rerender(<CarViewer look={NEUTRAL_LOOK} active />);
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
  await render(<CarViewer look={NEUTRAL_LOOK} active onFps={onFps} />);
  await screen.findByTestId('car-webview');
  await fromViewer({ type: 'fps', value: 58 });
  expect(onFps).toHaveBeenCalledWith(58);
});

test('renders only the silhouette when CAR_VIEWER_ENABLED is false', async () => {
  mockEnabled = false;
  await render(<CarViewer look={NEUTRAL_LOOK} active />);
  expect(screen.getByTestId('car-silhouette')).toBeTruthy();
  expect(screen.queryByTestId('car-webview')).toBeNull();
});
