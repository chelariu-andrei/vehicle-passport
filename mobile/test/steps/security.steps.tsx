import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';
import { AppState, Platform } from 'react-native';

import { appLock, resetAppLockForTests } from '@/features/account/model/appLock';
import { unlinkIdentity } from '@/shared/auth/session';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from '../fakes/auth';
import { openApp, reopenApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/security.feature', { loadRelativePath: true });

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const googleSignIn = GoogleSignin.signIn as jest.Mock;
const originalOS = Platform.OS;
const setOS = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

/* The app's AppState subscriptions, so a test can send it to the background and back. */
type Handler = (state: string) => void;
const handlers: Handler[] = [];
let appStateSpy: jest.SpyInstance;

beforeEach(() => {
  handlers.length = 0;
  appStateSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, handler: Handler) => {
    if (type === 'change') handlers.push(handler);
    return { remove: () => { const at = handlers.indexOf(handler); if (at >= 0) handlers.splice(at, 1); } };
  }) as never);
  authenticate.mockClear();
});

afterEach(() => {
  appStateSpy.mockRestore();
  setOS(originalOS);
  authenticate.mockImplementation(async () => ({ success: true }));
});

const changeAppState = (state: string) => act(() => handlers.forEach((handler) => handler(state)));
async function leaveAndReturn(seconds: number) {
  await changeAppState('background');
  // The router's test renderer runs on fake timers, so the clock is moved by hand.
  jest.setSystemTime(Date.now() + seconds * 1000);
  await changeAppState('active');
}
const unlockButton = () => screen.queryByRole('button', { name: en.appLock.unlock });

defineFeature(feature, (test) => {
  const openMethods = async () => {
    await openApp('/account/sign-in-methods', { routes: inertTabs });
    await screen.findByRole('button', { name: en.signInMethods.disconnectLabel(en.signInMethods.email) });
  };
  const openAccount = async () => {
    await openApp('/account', { routes: inertTabs });
    await screen.findByRole('button', { name: en.account.security });
  };
  const lockOn = async () => {
    await appLock.update({ enabled: true, timeout: '1m' });
    await openAccount();
  };

  test('The last sign-in method cannot be disconnected', ({ given, when, then, and }) => {
    given('I am signed in with email only', () => {
      fakeAuth.identities = [{ provider: 'email', id: 'identity-email' }];
    });
    when('I open Sign-in methods', openMethods);
    then('Disconnect is disabled for email and says why', async () => {
      const button = screen.getByRole('button', { name: en.signInMethods.disconnectLabel(en.signInMethods.email) });
      expect(button).toBeDisabled();
      expect(screen.getByText(en.auth.lastIdentity)).toBeTruthy();
      await fireEvent.press(button);
      expect(fakeAuth.unlinked).toEqual([]);
    });
    and('removing it directly is refused', async () => {
      await expect(unlinkIdentity('identity-email')).rejects.toMatchObject({ failure: 'last-identity' });
      expect(fakeAuth.unlinked).toEqual([]);
    });
  });

  test('Connecting Google shows it connected', ({ given, when, then }) => {
    given('I am signed in with email only on Android', () => {
      setOS('android');
      fakeAuth.identities = [{ provider: 'email', id: 'identity-email' }];
    });
    when('I open Sign-in methods and connect Google', async () => {
      googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-token' } });
      await openMethods();
      expect(screen.queryByRole('button', { name: en.signInMethods.connectLabel(en.signInMethods.apple) })).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: en.signInMethods.connectLabel(en.signInMethods.google) }));
    });
    then('Google is shown as connected and can be disconnected', async () => {
      const disconnect = await screen.findByRole('button', { name: en.signInMethods.disconnectLabel(en.signInMethods.google) });
      expect(disconnect).toBeEnabled();
      expect(fakeAuth.idTokenCalls.map((call) => call.provider)).toEqual(['google']);
      expect(screen.getAllByText(en.signInMethods.connected)).toHaveLength(2);
    });
  });

  test('Change password validates length', ({ given, when, then, and }) => {
    given('I am on Sign-in methods', openMethods);
    when('I try a password that is too short', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.signInMethods.newPassword), 'short');
      await fireEvent.press(screen.getByRole('button', { name: en.signInMethods.changePassword }));
    });
    then('I see the too short message and nothing is sent', async () => {
      expect(await screen.findByText(en.validation.passwordTooShort)).toBeTruthy();
      expect(fakeAuth.passwords).toEqual([]);
    });
    and('a valid password is saved with a confirmation', async () => {
      await fireEvent.changeText(screen.getByLabelText(en.signInMethods.newPassword), 'a-long-enough-password');
      await fireEvent.press(screen.getByRole('button', { name: en.signInMethods.changePassword }));
      expect(await screen.findByText(en.signInMethods.passwordChanged)).toBeTruthy();
      expect(fakeAuth.passwords).toEqual(['a-long-enough-password']);
      expect(screen.queryByText(en.validation.passwordTooShort)).toBeNull();
    });
  });

  test('The app locks after 1 minute in the background and unlocks with biometrics', ({ given, when, then }) => {
    given('the app lock is on with a 1 minute timeout', lockOn);
    when('I leave the app for 30 seconds and come back', async () => {
      await leaveAndReturn(30);
    });
    then('the app is not locked', () => {
      expect(unlockButton()).toBeNull();
      expect(screen.getByRole('button', { name: en.account.security })).toBeTruthy();
    });
    when('I leave the app for 2 minutes and come back', async () => {
      // The prompt that appears by itself is dismissed; the lock screen stays.
      authenticate.mockResolvedValueOnce({ success: false });
      await leaveAndReturn(120);
    });
    then('the app is locked', async () => {
      expect(await screen.findByRole('button', { name: en.appLock.unlock })).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.account.security })).toBeNull();
    });
    when('I unlock with biometrics', async () => {
      authenticate.mockResolvedValue({ success: true });
      await fireEvent.press(screen.getByRole('button', { name: en.appLock.unlock }));
    });
    then('the app is open again', async () => {
      await waitFor(() => expect(unlockButton()).toBeNull());
      expect(screen.getByRole('button', { name: en.account.security })).toBeTruthy();
    });
  });

  test('Failed biometrics keeps the app locked', ({ given, and, when, then }) => {
    given('the app lock is on with a 1 minute timeout', lockOn);
    and('I left the app for 2 minutes and came back with biometrics failing', async () => {
      authenticate.mockResolvedValue({ success: false });
      await leaveAndReturn(120);
      await screen.findByRole('button', { name: en.appLock.unlock });
    });
    when('I press Unlock and biometrics fail again', async () => {
      const before = authenticate.mock.calls.length;
      await fireEvent.press(screen.getByRole('button', { name: en.appLock.unlock }));
      await waitFor(() => expect(authenticate.mock.calls.length).toBe(before + 1));
    });
    then('the app stays locked', async () => {
      expect(await screen.findByText(en.appLock.failed)).toBeTruthy();
      expect(unlockButton()).toBeTruthy();
      expect(screen.queryByRole('button', { name: en.account.security })).toBeNull();
    });
  });

  test('Sign out everywhere else asks for confirmation', ({ given, when, then }) => {
    given('I am on Password and security', async () => {
      await openApp('/account/security', { routes: inertTabs });
      await screen.findByRole('button', { name: en.security.signOutOthers });
    });
    when('I choose to sign out everywhere else', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.security.signOutOthers }));
    });
    then('I am asked to confirm and nothing happens yet', async () => {
      expect(await screen.findByText(en.security.confirmTitle)).toBeTruthy();
      expect(fakeAuth.signOutScopes).toEqual([]);
    });
    when('I confirm', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.security.confirm }));
    });
    then('my other devices are signed out and I am told', async () => {
      expect(await screen.findByText(en.security.signedOutOthers)).toBeTruthy();
      expect(fakeAuth.signOutScopes).toEqual(['others']);
    });
  });

  test('The biometric offer appears once and never again after Not now', ({ given, when, then, and }) => {
    given('I have never been offered biometrics', async () => {
      await resetAppLockForTests({ offered: false });
    });
    when('I open the app', openAccount);
    then('I am offered biometrics', async () => {
      expect(await screen.findByText(en.biometricOffer.title)).toBeTruthy();
    });
    when('I choose Not now', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.biometricOffer.later }));
    });
    then('the offer is gone and it is remembered', async () => {
      await waitFor(() => expect(screen.queryByText(en.biometricOffer.title)).toBeNull());
      expect(appLock.get().enabled).toBe(false);
      await waitFor(async () => expect(JSON.parse((await SecureStore.getItemAsync('appLock')) ?? '{}')).toMatchObject({ offered: true, enabled: false }));
    });
    and('it does not come back when the app is opened again', async () => {
      await reopenApp('/account');
      await screen.findByRole('button', { name: en.account.security });
      expect(screen.queryByText(en.biometricOffer.title)).toBeNull();
    });
  });
});
