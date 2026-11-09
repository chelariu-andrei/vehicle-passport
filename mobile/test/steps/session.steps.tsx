import { useQuery } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { api, qk, unwrap } from '@/shared/api';
import { signOut } from '@/shared/auth/session';
import { en } from '@/shared/i18n/en';

import { fakeAuth, PASSWORD } from '../fakes/auth';
import type { FakeApi } from '../fake-api';
import { aVehicle, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/session.feature', { loadRelativePath: true });

/* The Garage tab is built in a later task. Until then this stands in for it: the same query and key, through the real provider. */
const vinsRendered: string[] = [];
function GaragePeek() {
  const garage = useQuery({ queryKey: qk.vehicles, queryFn: async () => unwrap(await api.GET('/vehicles')) });
  const vins = garage.data?.map((vehicle) => vehicle.vin) ?? [];
  useEffect(() => {
    vinsRendered.push(...vins);
  }, [vins.join()]); // eslint-disable-line react-hooks/exhaustive-deps -- a list that changed in content
  return (
    <View>
      <Text>{garage.data === undefined ? 'Loading garage' : vins.length === 0 ? 'The garage is empty' : vins.join(', ')}</Text>
    </View>
  );
}

async function fillAndSubmitSignIn(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText(en.auth.email), email);
  await fireEvent.changeText(screen.getByLabelText(en.auth.password), password);
  await fireEvent.press(screen.getByRole('button', { name: en.auth.signInAction }));
}

const seeSignIn = async () => {
  await waitFor(() => expect(screen).toHavePathname('/sign-in'));
  expect(screen.getByText(en.auth.signInTitle)).toBeTruthy();
};

defineFeature(feature, (test) => {
  let fake: FakeApi;

  test('An expired token is refreshed once', ({ given, when, then }) => {
    let before = 0;
    let result: unknown;
    given('my access token has expired', async () => {
      fake = await openApp('/');
      await waitFor(() => expect(screen).toHavePathname('/'));
      fake.expireToken(fakeAuth.token!);
      before = fake.callsTo('listMyVehicles').length;
    });
    when('a request answers 401 with an empty body', async () => {
      result = unwrap(await api.GET('/vehicles'));
    });
    then('the session is refreshed and the request is retried once', () => {
      expect(fakeAuth.refreshCalls).toBe(1);
      expect(fake.callsTo('listMyVehicles').length - before).toBe(2);
      expect(result).toEqual([]);
    });
  });

  test('A refused refresh signs me out', ({ given, then }) => {
    given('the retried request also answers 401', async () => {
      fake = await openApp('/');
      await waitFor(() => expect(screen).toHavePathname('/'));
      // The first attempt and the retry after the refresh both answer an empty 401.
      fake.failNext('listMyVehicles', 401, null);
      fake.failNext('listMyVehicles', 401, null);
      await act(async () => {
        await api.GET('/vehicles');
      });
    });
    then('I am returned to sign-in', async () => {
      await seeSignIn();
      expect(fakeAuth.signOutCalls).toBe(1);
    });
  });

  test('Signed-out users land on sign-in', ({ given, when, then }) => {
    given('I am signed out', () => {
      fakeAuth.clear();
    });
    when('the app opens', async () => {
      await openApp('/');
    });
    then('I see the sign-in screen', seeSignIn);
  });

  test('Wrong password is explained', ({ when, then, and }) => {
    when('I sign in with a wrong password', async () => {
      await openApp('/', { as: null });
      await seeSignIn();
      await fillAndSubmitSignIn('owner@example.com', 'not-the-password');
    });
    then('I am told the email or password is wrong', async () => {
      expect(await screen.findByText(en.auth.invalidCredentials)).toBeTruthy();
    });
    and('I stay on sign-in', () => {
      expect(screen).toHavePathname('/sign-in');
    });
  });

  test('A second account on the same phone sees nothing from the first', ({ given, when, then }) => {
    given(/^I am signed in as "(.*)" with a car in my garage$/, async (id: string) => {
      fake = await openApp('/', {
        as: { id, email: `${id}@example.com` },
        seed: (seeded) => seeded.state.vehicles.push(aVehicle()),
        routes: { '(tabs)/index': GaragePeek },
      });
      expect(await screen.findByText(SAMPLE_VIN)).toBeTruthy();
    });
    when(/^I sign out and sign in as "(.*)"$/, async (id: string) => {
      await act(async () => {
        await signOut();
      });
      await seeSignIn();
      // The server answers for the new account, which owns nothing.
      fake.state.vehicles.length = 0;
      vinsRendered.length = 0;
      await fillAndSubmitSignIn(`${id}@example.com`, PASSWORD);
    });
    then('the garage is empty', async () => {
      expect(await screen.findByText('The garage is empty')).toBeTruthy();
      // Not even for a moment: cached data from the first account must be gone, not just replaced.
      expect(vinsRendered).toEqual([]);
    });
  });
});
