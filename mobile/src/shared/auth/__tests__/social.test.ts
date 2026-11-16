import { createHash } from 'node:crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { getAppleCredential } from '@/shared/auth/social/apple';
import { signInWithApple, signInWithGoogle, unlinkIdentity, signOutOthers, AuthFailed } from '@/shared/auth/session';
import { fakeAuth } from '../../../../test/fakes/auth';

const signInAsync = AppleAuthentication.signInAsync as jest.Mock;
const googleSignIn = GoogleSignin.signIn as jest.Mock;

function cancelled(code: string) {
  return Object.assign(new Error('cancelled'), { code });
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return (error as AuthFailed).failure;
  }
  return undefined;
}

describe('social sign-in session layer', () => {
  const originalOS = Platform.OS;
  beforeEach(() => {
    signInAsync.mockReset();
    googleSignIn.mockReset();
    (Platform as { OS: string }).OS = 'ios';
  });
  afterEach(() => {
    (Platform as { OS: string }).OS = originalOS;
  });

  it('appleCancelledReturnsCancelledWithoutError', async () => {
    signInAsync.mockRejectedValue(cancelled('ERR_REQUEST_CANCELED'));
    await expect(signInWithApple()).resolves.toBe('cancelled');
    expect(fakeAuth.idTokenCalls).toHaveLength(0);
  });

  it('googleCancelledReturnsCancelled', async () => {
    googleSignIn.mockResolvedValue({ type: 'cancelled', data: null });
    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    googleSignIn.mockRejectedValue(cancelled('SIGN_IN_CANCELLED'));
    await expect(signInWithGoogle()).resolves.toBe('cancelled');
    expect(fakeAuth.idTokenCalls).toHaveLength(0);
  });

  it('googleSignsInWithIdToken', async () => {
    googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'g-token' } });
    await expect(signInWithGoogle()).resolves.toBe('signedIn');
    expect(fakeAuth.idTokenCalls).toEqual([{ provider: 'google', token: 'g-token', nonce: undefined }]);
  });

  it('appleSendsRawNonceToSupabaseAndHashedToApple', async () => {
    signInAsync.mockResolvedValue({ identityToken: 'a-token', fullName: null });
    await expect(signInWithApple()).resolves.toBe('signedIn');
    const hashed = signInAsync.mock.calls[0][0].nonce as string;
    const call = fakeAuth.idTokenCalls[0];
    expect(call.provider).toBe('apple');
    expect(call.nonce).toBeTruthy();
    expect(call.nonce).not.toBe(hashed);
    expect(hashed).toBe(createHash('sha256').update(call.nonce as string).digest('hex'));
  });

  it('appleFullNameReturnedOnFirstSignIn', async () => {
    signInAsync.mockResolvedValue({
      identityToken: 'a-token',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });
    await expect(getAppleCredential()).resolves.toMatchObject({ idToken: 'a-token', fullName: 'Ada Lovelace' });
    signInAsync.mockResolvedValue({ identityToken: 'a-token', fullName: null });
    const later = await getAppleCredential();
    expect(later?.fullName).toBeUndefined();
  });

  it('existingEmailOtherProviderMapsToAccountExists', async () => {
    signInAsync.mockResolvedValue({ identityToken: 'a-token', fullName: null });
    fakeAuth.idTokenError = { code: 'email_exists', name: 'AuthApiError', message: 'Email address already registered' };
    expect(await failureOf(signInWithApple())).toBe('account-exists-other-provider');
  });

  it('unlinkLastIdentityThrows', async () => {
    fakeAuth.identities = [{ provider: 'email', id: 'i1' }];
    expect(await failureOf(unlinkIdentity('i1'))).toBe('last-identity');
    expect(fakeAuth.unlinked).toEqual([]);
    fakeAuth.identities = [
      { provider: 'email', id: 'i1' },
      { provider: 'google', id: 'i2' },
    ];
    await unlinkIdentity('i2');
    expect(fakeAuth.unlinked).toEqual(['i2']);
  });

  it('signOutOthersUsesOthersScope', async () => {
    await signOutOthers();
    expect(fakeAuth.signOutScopes).toEqual(['others']);
  });

  it('appleUnavailableOnAndroid', async () => {
    (Platform as { OS: string }).OS = 'android';
    expect(await failureOf(signInWithApple())).toBe('provider-unavailable');
    expect(signInAsync).not.toHaveBeenCalled();
  });
});
