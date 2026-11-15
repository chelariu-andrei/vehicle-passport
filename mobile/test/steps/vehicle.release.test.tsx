import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Platform } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

import { aVehicle } from '../fake-api';
import { openApp } from '../harness';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('confirming gives the car up, returns to the garage and does not say the car was taken away', async () => {
  // Jest's iOS Modal never reports a dismissal; the menu's Android timer path stands in for it.
  jest.replaceProperty(Platform, 'OS', 'android');
  const fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.releaseConfirm }));

  expect(await screen.findByText(en.garage.emptyTitle)).toBeTruthy();
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(fake.callsTo('releaseVehicle')).toHaveLength(1);
  expect(fake.state.vehicles).toHaveLength(0);
  expect(screen.queryByText(en.vehicle.gone)).toBeNull();
});

test('cancelling the warning sends nothing', async () => {
  // Jest's iOS Modal never reports a dismissal; the menu's Android timer path stands in for it.
  jest.replaceProperty(Platform, 'OS', 'android');
  const fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.releaseKeep }));

  await waitFor(() => expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull());
  expect(fake.callsTo('releaseVehicle')).toHaveLength(0);
  expect(screen).toHavePathname('/');
});

/* RN's Jest Modal renders nothing while hidden, so its props are read from the instances that rendered. */
const modals: { props: { onDismiss?: () => void } }[] = [];
const realRender = Modal.prototype.render;
beforeEach(() => {
  modals.length = 0;
  jest.spyOn(Modal.prototype, 'render').mockImplementation(function (this: (typeof modals)[number]) {
    modals.push(this);
    return realRender.call(this);
  });
});
afterEach(() => jest.restoreAllMocks());
function menuModal() {
  return modals.findLast((m) => m.props.onDismiss);
}

async function chooseRelease() {

  const fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  return fake;
}

test('Android: the confirmation is presented after the menu closes, by timer, once', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const fake = await chooseRelease();

  // Two modals must never be on screen in the same tick.
  expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull();
  expect(await screen.findByText(en.vehicle.releaseBody)).toBeTruthy();
  expect(screen.getAllByText(en.vehicle.releaseTitle)).toHaveLength(1);
  expect(screen.queryByRole('button', { name: en.vehicle.edit })).toBeNull();
  expect(fake.callsTo('releaseVehicle')).toHaveLength(0);
});

test('iOS: no timer; the confirmation waits for the menu modal onDismiss and runs once', async () => {
  await chooseRelease();

  // Well past the Android fallback delay.
  await act(async () => jest.advanceTimersByTime(800));
  expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull();

  const menu = menuModal();
  await act(async () => {
    menu!.props.onDismiss!();
    menu!.props.onDismiss!();
  });
  expect(await screen.findByText(en.vehicle.releaseBody)).toBeTruthy();
  expect(screen.getAllByText(en.vehicle.releaseTitle)).toHaveLength(1);
});

test('a menu reopened before the action ran does not fire it on a later dismissal (iOS)', async () => {
  await chooseRelease();
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));

  const menu = menuModal();
  await act(async () => {
    menu!.props.onDismiss!();
  });
  expect(screen.queryByText(en.vehicle.releaseBody)).toBeNull();
});
