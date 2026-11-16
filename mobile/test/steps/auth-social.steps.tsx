import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';
import { Platform, Text } from 'react-native';

import { PENDING_CONSENT_KEY } from '@/features/auth/model/pendingConsent';
import { en } from '@/shared/i18n/en';

import { fakeAuth, PASSWORD } from '../fakes/auth';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/auth-social.feature', { loadRelativePath: true });

const googleSignIn = GoogleSignin.signIn as jest.Mock;
const originalOS = Platform.OS;
const setOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};
const legal = { '(auth)/legal/[type]': () => <Text>Legal</Text> };

afterEach(() => setOS(originalOS));

const buttonLabels = () => screen.getAllByRole('button').map((button) => button.props.accessibilityLabel as string);

async function typeCredentials(email: string, password: string) {
  await fireEvent.changeText(await screen.findByLabelText(en.auth.email), email);
  await fireEvent.changeText(screen.getByLabelText(en.auth.password), password);
}

async function fillSignUp(email: string, accept: boolean) {
  await fireEvent.changeText(await screen.findByLabelText(en.auth.displayName), 'Ana');
  await typeCredentials(email, PASSWORD);
  if (accept) await fireEvent.press(screen.getByRole('checkbox', { name: new RegExp(en.auth.termsLabel) }));
}

defineFeature(feature, (test) => {
  const signedOutOn = (os: string) => async () => {
    setOS(os);
    fakeAuth.clear();
  };
  const openSignIn = async () => {
    await openApp('/sign-in', { as: null });
    await screen.findByText(en.auth.signInTitle);
  };
  const openSignUp = async () => {
    await openApp('/sign-up', { as: null });
    await screen.findByText(en.auth.signUpTitle);
  };
  const pressGoogle = async () => {
    await openSignIn();
    await fireEvent.press(screen.getByRole('button', { name: en.auth.continueWithGoogle }));
  };

  test('Apple button appears first on iOS', ({ given, when, then }) => {
    given('I am on iOS and signed out', signedOutOn('ios'));
    when('I open sign-in', openSignIn);
    then('the Apple button comes before the Google button', () => {
      const labels = buttonLabels();
      expect(labels.indexOf(en.auth.continueWithApple)).toBeGreaterThanOrEqual(0);
      expect(labels.indexOf(en.auth.continueWithApple)).toBeLessThan(labels.indexOf(en.auth.continueWithGoogle));
    });
  });

  test('Android shows only the Google button', ({ given, when, then }) => {
    given('I am on Android and signed out', signedOutOn('android'));
    when('I open sign-in', openSignIn);
    then('I see the Google button and no Apple button', () => {
      expect(screen.getByRole('button', { name: en.auth.continueWithGoogle })).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.auth.continueWithApple })).toBeNull();
    });
  });

  test('Google sign-in succeeds and lands on the garage', ({ given, and, when, then }) => {
    given('I am on Android and signed out', signedOutOn('android'));
    and('Google will sign me in', () => {
      googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-token' } });
    });
    when('I continue with Google', pressGoogle);
    then('I land on the garage', async () => {
      await waitFor(() => expect(screen).toHavePathname('/'));
      expect(fakeAuth.idTokenCalls.map((call) => call.provider)).toEqual(['google']);
    });
  });

  test('Cancelling Google shows nothing', ({ given, and, when, then }) => {
    given('I am on Android and signed out', signedOutOn('android'));
    and('I cancel the Google sheet', () => {
      googleSignIn.mockResolvedValue({ type: 'cancelled' });
    });
    when('I continue with Google', pressGoogle);
    then('I stay on sign-in with no message', async () => {
      await waitFor(() => expect(googleSignIn).toHaveBeenCalled());
      expect(screen).toHavePathname('/sign-in');
      expect(screen.queryByRole('alert')).toBeNull();
      expect(fakeAuth.idTokenCalls).toHaveLength(0);
    });
  });

  test('Email already used with Apple shows the other-provider message', ({ given, and, when, then }) => {
    given('I am on Android and signed out', signedOutOn('android'));
    and('the email is already registered with another provider', () => {
      googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-token' } });
      fakeAuth.idTokenError = { code: 'email_exists', name: 'AuthApiError', message: 'A user with this email address has already been registered' };
    });
    when('I continue with Google', pressGoogle);
    then('I am told to sign in with my original method', async () => {
      expect(await screen.findByText(en.auth.accountExistsOtherProvider)).toBeTruthy();
      expect(screen.queryByText(/already been registered/)).toBeNull();
      expect(screen).toHavePathname('/sign-in');
    });
  });

  test('Sign-up needs the terms box', ({ given, when, then, and }) => {
    given('I am on the sign-up screen', openSignUp);
    when('I fill in the form without accepting the terms', async () => {
      await fillSignUp('new@example.com', false);
    });
    then('the create account button is disabled', () => {
      expect(screen.getByRole('button', { name: en.auth.signUpAction })).toBeDisabled();
    });
    and('ticking the terms enables it', async () => {
      await fireEvent.press(screen.getByRole('checkbox', { name: new RegExp(en.auth.termsLabel) }));
      expect(screen.getByRole('button', { name: en.auth.signUpAction })).toBeEnabled();
    });
  });

  test('Invalid email shows error under the field and keeps the value', ({ given, when, then, and }) => {
    given('I am on the sign-up screen', openSignUp);
    when('I submit an invalid email', async () => {
      await fillSignUp('not-an-email', true);
      await fireEvent.press(screen.getByRole('button', { name: en.auth.signUpAction }));
    });
    then('the email field shows the invalid email message', async () => {
      expect(await screen.findByText(en.validation.emailInvalid)).toBeTruthy();
      expect(fakeAuth.accounts.has('not-an-email')).toBe(false);
    });
    and('the email field still holds what I typed', () => {
      expect(screen.getByLabelText(en.auth.email).props.value).toBe('not-an-email');
    });
  });

  test('Wrong password shows the mismatch message', ({ given, when, then }) => {
    given('I am on sign-in', openSignIn);
    when('I sign in with a wrong password', async () => {
      await typeCredentials('owner@example.com', 'not-the-password');
      await fireEvent.press(screen.getByRole('button', { name: en.auth.signInAction }));
    });
    then('I am told the email or password is wrong', async () => {
      expect(await screen.findByText(en.auth.invalidCredentials)).toBeTruthy();
      expect(screen.getByLabelText(en.auth.email).props.value).toBe('owner@example.com');
    });
  });

  test('Forgot password sends a reset and confirms', ({ given, when, then }) => {
    given('I am on sign-in', openSignIn);
    when('I ask for a password reset for my email', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.auth.forgotPassword }));
      await fireEvent.changeText(await screen.findByLabelText(en.auth.email), 'owner@example.com');
      await fireEvent.press(screen.getByRole('button', { name: en.auth.sendResetLink }));
    });
    then('a reset email is sent and I see the confirmation', async () => {
      expect(await screen.findByText(en.auth.resetSent)).toBeTruthy();
      expect(fakeAuth.resetEmails).toEqual(['owner@example.com']);
    });
  });

  test('Confirmation sign-up remembers the accepted terms', ({ given, when, then }) => {
    given('the project asks for email confirmation', () => {
      fakeAuth.confirmationRequired = true;
    });
    when('I create an account with the terms accepted', async () => {
      await openSignUp();
      await fillSignUp('new@example.com', true);
      await fireEvent.press(screen.getByRole('button', { name: en.auth.signUpAction }));
    });
    then('I am asked to check my email and the consent is remembered', async () => {
      expect(await screen.findByText(en.auth.confirmationRequired)).toBeTruthy();
      expect(JSON.parse((await AsyncStorage.getItem(PENDING_CONSENT_KEY)) ?? 'null')).toEqual({ termsAccepted: true });
    });
  });

  test('The legal links open the legal screens', ({ given, when, then }) => {
    given('I am on the sign-up screen', async () => {
      await openApp('/sign-up', { as: null, routes: legal });
      await screen.findByText(en.auth.signUpTitle);
    });
    when('I tap Terms in the caption', async () => {
      await fireEvent.press(screen.getAllByText(en.auth.terms)[0]);
    });
    then('I am taken to the terms', async () => {
      await waitFor(() => expect(screen).toHavePathname('/legal/terms'));
    });
  });
});
