import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aPassport, aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp, reopenApp, submitDetails, typeVinAndContinue } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/look.feature', { loadRelativePath: true });

/* The stage is a WebView; Jest has no native one. This stub records what the app posts to it and lets a test answer as the page would. */
let mockProps: { onMessage: (event: { nativeEvent: { data: string } }) => void } | null = null;
const mockPost = jest.fn();
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
  const WebView = React.forwardRef(function WebViewStub(props: never, ref: never) {
    React.useImperativeHandle(ref, () => ({ postMessage: mockPost }));
    mockProps = props;
    return React.createElement(View, { testID: 'car-webview' });
  });
  return { WebView, default: WebView };
});
/* eslint-enable @typescript-eslint/no-require-imports */

const NEW_VIN = 'WBA8E1C50GK123456';
const NAME = 'Volkswagen Golf';

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const topic = (name: string) => fireEvent.press(screen.getByRole('tab', { name }));
const choose = (name: string) => fireEvent.press(screen.getByRole('radio', { name }));
const posted = () => mockPost.mock.calls.map(([raw]) => JSON.parse(raw as string) as { type: string; view?: string });

async function fromViewer(message: object) {
  await act(async () => {
    mockProps?.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  });
}

async function viewerReady() {
  await screen.findByTestId('car-webview');
  await fromViewer({ type: 'ready' });
}

const nudge = (name: string, action: 'increment' | 'decrement') =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', { nativeEvent: { actionName: action } });

beforeEach(async () => {
  await AsyncStorage.clear();
  mockPost.mockClear();
  mockProps = null;
});
afterEach(() => {
  jest.restoreAllMocks();
});

defineFeature(feature, (test) => {
  let fake: FakeApi;
  let reached = false;
  beforeEach(() => {
    reached = false;
  });

  /** A new car through the journey, up to step 3 with the stage ready. Idempotent within a scenario. */
  async function stepThree() {
    if (reached) return;
    reached = true;
    fake = await openApp('/onboarding');
    await typeVinAndContinue(NEW_VIN);
    await submitDetails();
    await screen.findByLabelText(en.journey.progress(3));
    await viewerReady();
  }
  const updates = () => fake.callsTo('updateVehicle');
  const lastUpdate = () => updates()[0].body as { appearance: Record<string, unknown>; plate: string | null };
  const doneTitle = () => screen.findByText(en.look.doneTitle(NAME));

  const givenStepThree = (given: (text: string | RegExp, fn: () => unknown) => void) => given(/^I (?:added a car through the journey|am on step three)$/, stepThree);

  test('Step three follows a new car', ({ given, then }) => {
    givenStepThree(given);
    then(/^I see "(.*)", the five topics and no Back button$/, async (step: string) => {
      await stepThree();
      expect(screen.getByLabelText(step)).toBeTruthy();
      for (const name of Object.values(en.look.topics)) expect(screen.getByRole('tab', { name })).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.common.back })).toBeNull();
      expect(screen.getByRole('button', { name: en.look.save })).toBeTruthy();
      expect(screen.getByRole('button', { name: en.look.skip })).toBeTruthy();
    });
  });

  test('Saving sends the whole look once', ({ given, when, and, then }) => {
    givenStepThree(given);
    when(/^I choose SUV, Blue, Matte, Aero wheels, black rims, dark tint, a black roof and the plate "(.*)"$/, async (plate: string) => {
      await stepThree();
      await topic(en.look.topics.shape);
      await choose(en.look.body.SUV);
      await topic(en.look.topics.paint);
      await choose('Blue');
      await choose(en.look.finish.MATTE);
      await topic(en.look.topics.wheels);
      await choose(en.look.wheels.AERO);
      await choose(en.look.rims.BLACK);
      await topic(en.look.topics.glass);
      await choose(en.look.tint.DARK);
      await fireEvent.press(screen.getByRole('switch', { name: en.look.roof }));
      await topic(en.look.topics.plate);
      await fireEvent.changeText(screen.getByLabelText(en.look.plate), plate);
    });
    and(/^I choose "(.*)"$/, async (name: string) => {
      await press(name);
    });
    then(/^one update is sent with appearance \{.*\} and plate "(.*)"$/, async (plate: string) => {
      await doneTitle();
      expect(updates()).toHaveLength(1);
      expect(lastUpdate()).toEqual({
        appearance: {
          bodyType: 'SUV',
          color: 'BLUE',
          finish: 'MATTE',
          wheels: 'AERO',
          rimColor: 'BLACK',
          glassTint: 'DARK',
          contrastRoof: true,
        },
        plate,
      });
    });
    and('I see "… is in your garage"', async () => {
      expect(await doneTitle()).toBeTruthy();
    });
  });

  test('Skipping sends nothing', ({ when, then }) => {
    when(/^I choose "(.*)"$/, async (name: string) => {
      await stepThree();
      await press(name);
    });
    then('no update is sent and I see "… is in your garage"', async () => {
      expect(await doneTitle()).toBeTruthy();
      expect(updates()).toHaveLength(0);
    });
  });

  test('An empty plate is sent as none', ({ when, then }) => {
    when('I save without typing a plate', async () => {
      await stepThree();
      await press(en.look.save);
      await doneTitle();
    });
    then('the update carries plate null', () => {
      expect(updates()).toHaveLength(1);
      expect(lastUpdate().plate).toBeNull();
    });
  });

  test('A strange plate is tamed', ({ when, then }) => {
    when(/^I type "(.*)" as the plate$/, async (text: string) => {
      await stepThree();
      await topic(en.look.topics.plate);
      await fireEvent.changeText(screen.getByLabelText(en.look.plate), text);
    });
    then('the field shows at most 10 characters, upper case, with single spaces', async () => {
      const field = screen.getByLabelText(en.look.plate);
      expect(field.props.value).toBe('B-12ABC DE');
      // A paste whose raw length passes 10 but whose cleaned text fits keeps every character.
      await fireEvent.changeText(field, '🚗b  123  abc');
      expect(screen.getByLabelText(en.look.plate).props.value).toBe('B 123 ABC');
      await fireEvent.changeText(field, 'b-12🙂abc  def ghi');
      // No native cut: a paste is cleaned first, then cut, so no valid character is lost to emoji or double spaces.
      expect(field.props.maxLength).toBeUndefined();
      // What the stage draws is the same cleaned text.
      await waitFor(() => expect(posted().some((m) => JSON.stringify(m).includes('"plate":"B-12ABC DE"'))).toBe(true));
      expect(posted().some((m) => JSON.stringify(m).includes('🙂'))).toBe(false);
      await press(en.look.save);
      await doneTitle();
      expect(lastUpdate().plate).toBe('B-12ABC DE');
    });
  });

  /** Opens Any colour and moves the hue one step at a time until the shade is filed under blue. */
  async function moveHueToBlue() {
    await topic(en.look.topics.paint);
    await choose(en.look.anyColour);
    for (let i = 0; i < 36 && !screen.queryByText(/filed under blue/); i += 1) await nudge(en.look.hue, 'increment');
  }

  test('Any colour is filed under a named one', ({ when, then, and }) => {
    when(/^I open "(.*)" and move the hue to blue$/, async () => {
      await stepThree();
      await moveHueToBlue();
    });
    then(/^I see "(.*)"$/, (text: string) => {
      expect(screen.getByText(new RegExp(text))).toBeTruthy();
    });
    and('saving sends a colorHex and color BLUE', async () => {
      await press(en.look.save);
      await doneTitle();
      expect(lastUpdate().appearance).toMatchObject({ color: 'BLUE', colorHex: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    });
  });

  test('Picking a named colour drops the custom shade', ({ given, when, then }) => {
    given('I chose a custom shade', async () => {
      await stepThree();
      await topic(en.look.topics.paint);
      await choose(en.look.anyColour);
      await nudge(en.look.hue, 'increment');
    });
    when(/^I choose "(.*)" and save$/, async (name: string) => {
      await choose(name);
      await press(en.look.save);
      await doneTitle();
    });
    then('the update carries color RED and no colorHex', () => {
      expect(lastUpdate().appearance.color).toBe('RED');
      expect(lastUpdate().appearance).not.toHaveProperty('colorHex');
    });
  });

  test('The stage turns to the topic', ({ when, then }) => {
    when(/^I open "(.*)"$/, async (name: string) => {
      await stepThree();
      await topic(name);
    });
    then(/^the viewer is told to turn to "(.*)"$/, async (view: string) => {
      await waitFor(() => expect(posted()).toContainEqual({ type: 'turnTo', view }));
    });
  });

  test('The look works without 3D', ({ given, and, then }) => {
    given('the viewer reports an error', async () => {
      await stepThree();
      await fromViewer({ type: 'error' });
    });
    then(/^I see the silhouette, and choosing "(.*)" changes it$/, async (name: string) => {
      expect(screen.queryByTestId('car-webview')).toBeNull();
      const stage = within(screen.getByTestId('look-stage'));
      expect(stage.getByTestId('car-silhouette')).toBeTruthy();
      await topic(en.look.topics.shape);
      await choose(name);
      expect(stage.getByLabelText(name)).toBeTruthy();
    });
    and(/^saving still sends bodyType (.*)$/, async (body: string) => {
      await press(en.look.save);
      await doneTitle();
      expect(lastUpdate().appearance.bodyType).toBe(body);
    });
  });

  test('Saving fails', ({ given, when, then, and }) => {
    given('the API answers 503 to the update', async () => {
      await stepThree();
      fake.failNext('updateVehicle', 503, null);
    });
    when(/^I choose "(.*)"$/, async (name: string) => {
      await press(name);
    });
    then(/^I stay on step three with "(.*)"$/, async (message: string) => {
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.getByLabelText(en.journey.progress(3))).toBeTruthy();
      // The car is registered all the same.
      expect(fake.state.vehicles.map((v) => v.vin)).toEqual([NEW_VIN]);
    });
    and(/^"(.*)" still shows "… is in your garage"$/, async (name: string) => {
      await press(name);
      expect(await doneTitle()).toBeTruthy();
    });
  });

  /** The last screen of the journey, reached by skipping. */
  async function lastScreen() {
    await stepThree();
    await press(en.look.skip);
    await doneTitle();
  }

  test('Add first service scans for this car', ({ given, when, then }) => {
    given('I am on the last screen', lastScreen);
    when(/^I choose "(.*)"$/, async (name: string) => {
      await press(name);
    });
    then("the capture screen opens for the new car's VIN", async () => {
      await waitFor(() => expect(screen).toHavePathname('/scans/new'));
      expect(screen).toHaveSearchParams({ vin: NEW_VIN });
    });
  });

  test('Later lands on the Car tab', ({ when, then }) => {
    when(/^I choose "(.*)" on the last screen$/, async (name: string) => {
      await lastScreen();
      await press(name);
    });
    then("the title is the new car's name", async () => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(await screen.findByText(NAME)).toBeTruthy();
    });
  });

  test('A car without a look is offered one', ({ given, then, when }) => {
    given('I own a car with no appearance', async () => {
      fake = await openApp('/', { seed: (api) => api.state.vehicles.push(aVehicle()) });
      await screen.findByText(NAME);
    });
    then(/^the home screen shows "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.getByText(en.look.hintBody)).toBeTruthy();
    });
    when('I dismiss it and reopen the app', async () => {
      await press(en.look.hintDismiss);
      await waitFor(() => expect(screen.queryByText(en.look.hintTitle)).toBeNull());
      await reopenApp('/');
      await screen.findByText(NAME);
      await act(async () => jest.advanceTimersByTime(100));
    });
    then('it is not shown', () => {
      expect(screen.queryByText(en.look.hintTitle)).toBeNull();
    });
  });

  test('Changing the look later', ({ given, when, then, and }) => {
    given('I own a red sedan', async () => {
      fake = await openApp('/', {
        seed: (api) => api.state.vehicles.push(aVehicle({ appearance: { bodyType: 'SEDAN', color: 'RED' } })),
      });
      await screen.findByText(NAME);
    });
    when(/^I choose "(.*)" from the car's options, choose "(.*)" and save$/, async (change: string, body: string) => {
      // Jest's iOS Modal never reports a dismissal, so the Android timer path stands in.
      jest.replaceProperty(Platform, 'OS', 'android');
      await press(en.vehicle.more);
      await press(change);
      await screen.findByRole('tab', { name: en.look.topics.shape });
      expect(screen.queryByLabelText(en.journey.progress(3))).toBeNull();
      await choose(body);
      await press(en.look.save);
    });
    then(/^the update carries bodyType (.*) and color (.*)$/, async (bodyType: string, color: string) => {
      await waitFor(() => expect(updates()).toHaveLength(1));
      expect(lastUpdate().appearance).toMatchObject({ bodyType, color });
    });
    and('Back returns to the home screen', async () => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(await screen.findByText(NAME)).toBeTruthy();
    });
  });

  test('The plate never reaches a passport screen', ({ given, when, then }) => {
    const passport = aPassport({ vin: SAMPLE_VIN });
    given(/^my car has plate "(.*)" and a passport$/, async () => {
      fake = await openApp(`/passports/${passport.id}`, {
        seed: (api) => {
          api.state.vehicles.push(aVehicle({ plate: 'B 123 ABC' }));
          api.state.passports.push(passport);
        },
      });
    });
    when('I open the passport', async () => {
      expect(await screen.findByText(en.passport.frozen)).toBeTruthy();
    });
    then(/^"(.*)" is not on the screen$/, (plate: string) => {
      expect(screen.queryByText(new RegExp(plate))).toBeNull();
    });
  });
});
