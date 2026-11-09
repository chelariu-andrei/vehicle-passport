import { useMutation } from '@tanstack/react-query';

import { AuthFailed, signIn, signUp } from '@/shared/auth/session';
import { en } from '@/shared/i18n/en';

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthFailed)) return en.errors.generic;
  switch (error.failure) {
    case 'invalid-credentials':
      return en.auth.invalidCredentials;
    case 'email-taken':
      return en.auth.emailTaken;
    case 'weak-password':
      return en.auth.weakPassword;
    case 'network':
      return en.errors.network;
    default:
      return en.errors.generic;
  }
}

type Credentials = { email: string; password: string };

export function useSignIn() {
  return useMutation({ mutationFn: ({ email, password }: Credentials) => signIn(email, password) });
}

export function useSignUp() {
  return useMutation({ mutationFn: ({ email, password }: Credentials) => signUp(email, password) });
}
