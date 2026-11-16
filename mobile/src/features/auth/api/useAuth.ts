import { useMutation } from '@tanstack/react-query';

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

type Credentials = { email: string; password: string };

export function useSignIn() {
  return useMutation({ mutationFn: ({ email, password }: Credentials) => signIn(email, password) });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}

export function useSignUp() {
  return useMutation({
    mutationFn: ({ email, password, displayName }: Credentials & { displayName: string }) => signUp(email, password, displayName),
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
