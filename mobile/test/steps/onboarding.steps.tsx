import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { claimStore, EMPTY_DRAFT, journeyDraftStore } from '@/features/vehicle';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import type { FakeApi } from '../fake-api';
import { aVehicle } from '../fake-api';
import { openApp, openJourney, submitDetails, typeVinAndContinue } from '../harness';

setJestCucumberConfiguration({ errors: true });

/** Steps 3 and 4 of the journey are covered by look.feature; here the car is simply left to the Car tab. */
async function skipLook() {
  await fireEvent.press(await screen.findByRole('button', { name: en.look.skip }));
  await fireEvent.press(await screen.findByRole('button', { name: en.journey.later }));
}
const feature = loadFeature('../../features/onboarding.feature', { loadRelativePath: true });

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

const BMW_VIN = 'WBA8E1C50GK123456';
const OTHER_VIN = 'WBAZZZ1JZXW000002';

beforeEach(async () => {
  await AsyncStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const vinField = () => screen.getByLabelText(en.vehicleForm.vin);
const me = () => fakeAuth.userId!;

/** The Car tab with one car, from which the journey is opened the way a person would. */
async function ownGolf(extra: (api: FakeApi) => void = () => undefined) {
  const fake = await openApp('/', {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      extra(api);
    },
  });
  await screen.findByText('Volkswagen Golf');
  return fake;
}

/** With one car the entry is the overflow menu; Jest's iOS Modal never reports a dismissal, so the Android timer path stands in. */
async function openFromOneCar() {
  jest.replaceProperty(Platform, 'OS', 'android');
  await press(en.vehicle.more);
  await press(en.cars.add);
  await screen.findByText(en.journey.vinTitle);
}

async function returnToApp() {
  await act(async () => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

defineFeature(feature, (test) => {
  let fake: FakeApi;

  test('The journey starts by itself in an empty garage', ({ given, when, then, and }) => {
    given('I have no cars and no pending claims', () => undefined);
    when('I open the app', async () => {
      fake = await openApp('/', { autoJourney: true });
    });
    then(/^I see "(.*)" and "(.*)"$/, async (title: string, step: string) => {
      expect(await screen.findByText(title)).toBeTruthy();
      expect(screen.getByLabelText(step)).toBeTruthy();
    });
    and('there is no Back button', () => {
      expect(screen.queryByRole('button', { name: en.common.back })).toBeNull();
    });
  });

  test('It does not start while a claim is waiting', ({ given, when, then }) => {
    given('I have no cars and one pending claim', async () => {
      await claimStore.upsert(me(), { claimId: 'c1', vin: OTHER_VIN, filedAt: '2025-01-15T10:00:00Z' });
    });
    when('I open the app', async () => {
      fake = await openApp('/', { autoJourney: true });
    });
    then(/^I see "(.*)"$/, async (title: string) => {
      expect(await screen.findByText(title)).toBeTruthy();
      expect(await screen.findByText(en.garage.waiting)).toBeTruthy();
      expect(screen).toHavePathname('/');
      expect(screen.queryByText(en.journey.vinTitle)).toBeNull();
    });
  });

  test('Later leaves and does not ask again this launch', ({ given, when, then, and }) => {
    given('the journey started by itself', async () => {
      fake = await openApp('/', { autoJourney: true });
      expect(await screen.findByText(en.journey.vinTitle)).toBeTruthy();
    });
    when(/^I choose "(.*)"$/, async (name: string) => {
      await press(name);
    });
    then(/^I see "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
    });
    and('returning to the Car tab does not reopen the journey', async () => {
      await returnToApp();
      await act(async () => jest.advanceTimersByTime(50));
      expect(screen).toHavePathname('/');
      expect(screen.queryByText(en.journey.vinTitle)).toBeNull();
    });
  });

  const typeOnStepOne = async (text: string) => {
    fake = await ownGolf();
    await openFromOneCar();
    await fireEvent.changeText(vinField(), text);
  };

  test('The VIN is cleaned as it is typed', ({ when, then, and }) => {
    when(/^I type "(.*)"$/, typeOnStepOne);
    then(/^the field shows "(.*)" and "(.*)"$/, (value: string, count: string) => {
      expect(vinField().props.value).toBe(value);
      expect(screen.getByText(count)).toBeTruthy();
    });
    and(/^I see "(.*)"$/, (text: string) => {
      expect(screen.getByText(text)).toBeTruthy();
    });
  });

  test('Continue waits for 17 characters', ({ when, then }) => {
    when(/^I type "(.*)"$/, typeOnStepOne);
    then(/^"(.*)" is disabled$/, (name: string) => {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    });
  });

  test('The make is suggested, not imposed', ({ given, when, then }) => {
    given('I typed a BMW VIN and continued', async () => {
      fake = await ownGolf();
      await openFromOneCar();
      await typeVinAndContinue(BMW_VIN);
    });
    then(/^Make holds "(.*)"$/, (make: string) => {
      expect(screen.getByLabelText(en.vehicleForm.make).props.value).toBe(make);
    });
    when(/^I change it to "(.*)" and add the car$/, async (make: string) => {
      await submitDetails({ make, model: '3 Series' });
    });
    then(/^the request carries make "(.*)"$/, async (make: string) => {
      await waitFor(() => expect(fake.callsTo('registerVehicle')).toHaveLength(1));
      expect(fake.callsTo('registerVehicle')[0].body).toMatchObject({ vin: BMW_VIN, make });
    });
  });

  test('Back keeps what I typed', ({ given, when, then }) => {
    given('I am on step 2 with a model typed', async () => {
      fake = await ownGolf();
      await openFromOneCar();
      await typeVinAndContinue(BMW_VIN);
      await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), '3 Series');
    });
    when('I go back and continue again', async () => {
      await press(en.common.back);
      expect(await screen.findByText(en.journey.vinTitle)).toBeTruthy();
      await press(en.journey.continue);
      await screen.findByText(en.journey.detailsTitle);
    });
    then('the model is still there', () => {
      expect(screen.getByLabelText(en.vehicleForm.model).props.value).toBe('3 Series');
    });
  });

  test('A newly registered car becomes the active car', ({ given, when, then }) => {
    given('I own a Volkswagen Golf', async () => {
      fake = await ownGolf();
    });
    when('I add a BMW through the journey', async () => {
      await openFromOneCar();
      await typeVinAndContinue(BMW_VIN);
      await submitDetails({ make: 'BMW', model: '3 Series' });
      await skipLook();
    });
    then('the BMW is the active car', async () => {
      expect(await screen.findByText('BMW 3 Series')).toBeTruthy();
      expect(screen).toHavePathname('/');
    });
  });

  test('A VIN with an owner files a claim', ({ when, then, and }) => {
    when('I submit a VIN that someone else owns', async () => {
      fake = await ownGolf((api) => api.state.otherOwnerVins.add(OTHER_VIN));
      await openFromOneCar();
      await typeVinAndContinue(OTHER_VIN);
      await submitDetails();
    });
    then(/^I see the claim-filed screen and "(.*)" takes me to the Car tab$/, async (done: string) => {
      expect(await screen.findByText(en.vehicleForm.filedTitle)).toBeTruthy();
      expect(screen.getByText(en.vehicleForm.filedBody)).toBeTruthy();
      await press(done);
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(await screen.findByText('Volkswagen Golf')).toBeTruthy();
    });
    and('no car was added', () => {
      expect(fake.state.vehicles).toHaveLength(1);
    });
  });

  test('A car I already own is one tap away', ({ when, then, and }) => {
    const duster = aVehicle({ vin: 'UU1HSDDN5K0000002', make: 'Dacia', model: 'Duster' });
    when('I submit a VIN that is already mine', async () => {
      fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle(), duster) });
      await screen.findByText('Volkswagen Golf');
      await openJourney();
      await typeVinAndContinue(duster.vin);
      await submitDetails({ make: 'Dacia', model: 'Duster' });
    });
    then(/^I am told "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
      expect(fake.callsTo('registerVehicle')[0].body).toEqual({
        vin: duster.vin,
        make: 'Dacia',
        model: 'Duster',
        year: 2015,
        fuel: 'DIESEL',
      });
    });
    and(/^"(.*)" makes it the active car$/, async (name: string) => {
      await press(name);
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(await screen.findByText('Dacia Duster')).toBeTruthy();
    });
  });

  test('The server refuses the VIN', ({ when, then }) => {
    when(/^the API answers 400 "(.*)"$/, async (code: string) => {
      fake = await ownGolf();
      await openFromOneCar();
      await typeVinAndContinue(BMW_VIN);
      fake.failNext('registerVehicle', 400, code);
      await submitDetails({ make: 'BMW', model: '3 Series' });
    });
    then('I am on step 1 with the message under the VIN field', async () => {
      expect(await screen.findByText(en.journey.vinTitle)).toBeTruthy();
      expect(screen.getByText(en.errors.codes['invalid-vin'])).toBeTruthy();
    });
  });

  test('Leaving with something typed offers to keep it', ({ given, when, then }) => {
    given('I typed a VIN', async () => {
      fake = await ownGolf();
      await openFromOneCar();
      await fireEvent.changeText(vinField(), BMW_VIN);
    });
    when(/^I choose "(.*)"$/, async (name: string) => {
      await press(name);
    });
    then(/^I am asked "(.*)"$/, async (title: string) => {
      expect(await screen.findByText(title)).toBeTruthy();
    });
    when(/^I choose "(.*)" and open the journey again$/, async (name: string) => {
      await press(name);
      await waitFor(() => expect(screen).toHavePathname('/'));
      await openFromOneCar();
    });
    then('the VIN is filled in', () => {
      expect(vinField().props.value).toBe(BMW_VIN);
    });
  });

  test('Discarding clears the draft', ({ given, when, then }) => {
    given('I typed a VIN and chose "Later" then "Discard"', async () => {
      fake = await ownGolf();
      await openFromOneCar();
      await fireEvent.changeText(vinField(), BMW_VIN);
      await press(en.journey.later);
      await press(en.common.discard);
      await waitFor(() => expect(screen).toHavePathname('/'));
    });
    when('I open the journey again', async () => {
      await openFromOneCar();
    });
    then('the VIN field is empty', () => {
      expect(vinField().props.value).toBe('');
    });
  });

  test('A draft belongs to its account', ({ given, when, then }) => {
    given('another account left a draft on this phone', async () => {
      await journeyDraftStore.set('someone-else', { ...EMPTY_DRAFT, vin: BMW_VIN });
      fake = await ownGolf();
    });
    when('I open the journey', async () => {
      await openFromOneCar();
    });
    then('the VIN field is empty', () => {
      expect(vinField().props.value).toBe('');
    });
  });

  test('A submitted car leaves no draft', ({ given, when, then }) => {
    given('I added a car through the journey', async () => {
      fake = await ownGolf();
      await openFromOneCar();
      await typeVinAndContinue(BMW_VIN);
      await submitDetails({ make: 'BMW', model: '3 Series' });
      await skipLook();
      expect(await screen.findByText('BMW 3 Series')).toBeTruthy();
      // Time for a debounced write that must never happen to show itself.
      await act(async () => jest.advanceTimersByTime(400));
    });
    when('I open the journey again', async () => {
      // Two cars now: adding a third lives in the car list.
      await openJourney();
    });
    then('the VIN field is empty', async () => {
      expect(vinField().props.value).toBe('');
      expect(await journeyDraftStore.get(me())).toBeNull();
    });
  });
});
