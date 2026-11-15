import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Modal, Platform } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { aVehicle } from '../fake-api';
import { openApp, typeVinAndContinue } from '../harness';

/* The Car tab's stage is a WebView; Jest has no native one. */
jest.mock('expo-asset', () => ({
  Asset: {
    fromModule: () => ({ downloadAsync: async () => ({ localUri: 'file:///viewer.html', uri: 'file:///viewer.html' }) }),
  },
}));
jest.mock('../../assets/viewer/viewer.html', () => 1, { virtual: true });
/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must require lazily */
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef(function WebViewStub(_props: never, ref: never) {
    React.useImperativeHandle(ref, () => ({ postMessage: () => undefined }));
    return React.createElement(View, { testID: 'car-webview' });
  });
  return { WebView, default: WebView };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const VIN = 'WBA8E1C50GK123456';

/* RN's Jest Modal renders nothing while hidden, so its props are read from the instances that rendered. */
const modals: { props: { onDismiss?: () => void } }[] = [];
const realRender = Modal.prototype.render;
beforeEach(async () => {
  await AsyncStorage.clear();
  modals.length = 0;
  jest.spyOn(Modal.prototype, 'render').mockImplementation(function (this: (typeof modals)[number]) {
    modals.push(this);
    return realRender.call(this);
  });
});
afterEach(() => jest.restoreAllMocks());

async function openJourneyByRoute() {
  await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await screen.findByText('Volkswagen Golf');
  await act(async () => router.push('/onboarding'));
  await screen.findByText(en.journey.vinTitle);
}

const goBack = () => act(async () => router.back());

test('router.back() on step 2 returns to step 1', async () => {
  await openJourneyByRoute();
  await typeVinAndContinue(VIN);
  await goBack();
  expect(await screen.findByText(en.journey.vinTitle)).toBeTruthy();
  expect(screen).toHavePathname('/onboarding');
});

test('router.back() on step 1 with something typed asks about the draft and stays', async () => {
  await openJourneyByRoute();
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.vin), VIN);
  await goBack();
  expect(await screen.findByText(en.journey.draftTitle)).toBeTruthy();
  expect(screen).toHavePathname('/onboarding');
});

test('router.back() on step 1 with nothing typed just leaves', async () => {
  await openJourneyByRoute();
  await goBack();
  await waitFor(() => expect(screen).toHavePathname('/'));
});

describe.each([
  ['Keep draft', () => en.journey.keepDraft],
  ['Discard', () => en.common.discard],
])('%s', (_name, label) => {
  async function chooseOnSheet() {
    await openJourneyByRoute();
    await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.vin), VIN);
    await goBack();
    const back = jest.spyOn(router, 'back');
    await fireEvent.press(await screen.findByRole('button', { name: label() }));
    return back;
  }

  test('Android: leaves once, after the sheet has gone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const back = await chooseOnSheet();
    expect(back).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1000));
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(back).toHaveBeenCalledTimes(1);
  });

  test('iOS: waits for the sheet modal onDismiss and leaves once', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const back = await chooseOnSheet();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(back).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/onboarding');

    const sheet = modals.findLast((m) => m.props.onDismiss);
    await act(async () => {
      sheet!.props.onDismiss!();
      sheet!.props.onDismiss!();
    });
    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
