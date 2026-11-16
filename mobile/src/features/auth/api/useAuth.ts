import { useMutation } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import {
  AuthFailed,
  sendPasswordReset,
  signIn,
  signInWithApple,
  signInWithGoogle,
  signOut,
  signUp,
  startPasswordRecovery,
  updatePassword,
  type SocialProvider,
} from '@/shared/auth/session';
import type { Strings } from '@/shared/i18n';

import { clearPendingConsent, rememberPendingConsent, type ShownVersions } from '../model/pendingConsent';

export function authErrorMessage(error: unknown, s: Strings): string {
  if (!(error instanceof AuthFailed)) return s.errors.generic;
  switch (error.failure) {
    case 'invalid-credentials':
      return s.auth.invalidCredentials;
    case 'email-taken':
      return s.auth.emailTaken;
    case 'weak-password':
      return s.auth.weakPassword;
    case 'account-exists-other-provider':
      return s.auth.accountExistsOtherProvider;
    case 'provider-unavailable':
      return s.auth.providerUnavailable;
    case 'last-identity':
      return s.auth.lastIdentity;
    case 'network':
      return s.errors.network;
    default:
      return s.errors.generic;
  }
}

/** Which field a failure belongs under. */
export function authErrorField(error: unknown): 'email' | 'password' {
  return error instanceof AuthFailed && error.failure === 'email-taken' ? 'email' : 'password';
}

/** The wait for the legal versions at sign-up; the sign-up itself must not hang on it. */
const VERSIONS_TIMEOUT_MS = 5_000;

/** The terms and privacy versions the sign-up form is showing now, or null when they cannot be fetched in time (never guessed). */
async function fetchShownVersions(): Promise<ShownVersions | null> {
  try {
    const request = api.GET('/public/legal/documents', { params: { query: { locale: 'en' } } }).then((r) => unwrap(r).documents);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), VERSIONS_TIMEOUT_MS));
    const documents = await Promise.race([request, timeout]);
    const terms = documents.find((d) => d.type === 'terms')?.version;
    const privacy = documents.find((d) => d.type === 'privacy')?.version;
    return terms && privacy ? { terms, privacy } : null;
  } catch {
    return null;
  }
}

type Credentials = { email: string; password: string };

export function useSignIn() {
  return useMutation({ mutationFn: ({ email, password }: Credentials) => signIn(email, password) });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password, displayName }: Credentials & { displayName: string }) => {
      // The terms were accepted in the form. The flag is saved before the session exists: the consent gate reads it once, as soon as
      // sign-up signs the person in. It is removed when sign-up fails; when confirmation is required it stays for the first sign-in.
      await rememberPendingConsent(email, await fetchShownVersions());
      try {
        return await signUp(email, password, displayName);
      } catch (error) {
        await clearPendingConsent();
        throw error;
      }
    },
  });
}

export function useSocialSignIn() {
  return useMutation({
    mutationFn: (provider: SocialProvider) => (provider === 'apple' ? signInWithApple() : signInWithGoogle()),
  });
}

export function useSendPasswordReset() {
  return useMutation({ mutationFn: (email: string) => sendPasswordReset(email) });
}

export function useStartRecovery() {
  return useMutation({ mutationFn: (code: string) => startPasswordRecovery(code) });
}

export function useUpdatePassword() {
  return useMutation({ mutationFn: (password: string) => updatePassword(password) });
}
