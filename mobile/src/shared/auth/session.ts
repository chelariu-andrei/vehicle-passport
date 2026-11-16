/* Who is signed in, and what must happen when they are not any more. */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { getAppleCredential } from './social/apple';
import { getGoogleCredential } from './social/google';
import { supabase } from './supabase';

export type SessionStatus = 'loading' | 'signedIn' | 'signedOut';
export interface SessionState {
  status: SessionStatus;
  userId: string | null;
  email: string | null;
}

const LOADING: SessionState = { status: 'loading', userId: null, email: null };
const SIGNED_OUT: SessionState = { status: 'signedOut', userId: null, email: null };

let state: SessionState = LOADING;
const subscribers = new Set<() => void>();
const endCallbacks = new Set<() => void>();

function publish(next: SessionState): void {
  state = next;
  subscribers.forEach((notify) => notify());
}

/** Runs when the account that was signed in no longer is: sign-out, a lost session, or a different account. */
function endSession(): void {
  endCallbacks.forEach((cleanup) => {
    try {
      cleanup();
    } catch (error) {
      console.warn('A session cleanup failed', error);
    }
  });
}

function apply(session: { user: { id: string; email?: string | null } } | null): void {
  const previous = state.userId;
  if (session === null) {
    publish(SIGNED_OUT);
    if (previous !== null) endSession();
    return;
  }
  const next: SessionState = { status: 'signedIn', userId: session.user.id, email: session.user.email ?? null };
  if (previous !== null && previous !== next.userId) endSession();
  if (state.status !== 'signedIn' || state.userId !== next.userId || state.email !== next.email) publish(next);
}

/** Follows the Supabase session until the returned function is called. The root layout owns this. */
export function startSession(): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
  return () => {
    data.subscription.unsubscribe();
    publish(LOADING);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => void subscribers.delete(notify);
    },
    () => state,
  );
}

/** Registers cleanup for the end of a session, such as clearing a cache. Returns the way to unregister. */
export function onSessionEnd(cleanup: () => void): () => void {
  endCallbacks.add(cleanup);
  return () => void endCallbacks.delete(cleanup);
}

export type AuthFailure =
  | 'invalid-credentials'
  | 'email-taken'
  | 'weak-password'
  | 'network'
  | 'account-exists-other-provider'
  | 'provider-unavailable'
  | 'last-identity'
  | 'other';

export class AuthFailed extends Error {
  readonly failure: AuthFailure;
  constructor(failure: AuthFailure) {
    super(failure);
    this.name = 'AuthFailed';
    this.failure = failure;
  }
}

function classify(error: { code?: string; name?: string }): AuthFailure {
  if (error.name === 'AuthRetryableFetchError') return 'network';
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid-credentials';
    case 'user_already_exists':
    case 'email_exists':
      return 'email-taken';
    case 'weak_password':
      return 'weak-password';
    default:
      return 'other';
  }
}

async function attempt<T extends { error: { code?: string; name?: string } | null }>(call: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch {
    throw new AuthFailed('network');
  }
  if (result.error) throw new AuthFailed(classify(result.error));
  return result;
}

export async function signIn(email: string, password: string): Promise<void> {
  await attempt(() => supabase.auth.signInWithPassword({ email, password }));
}

/** Resolves 'confirmationRequired' when the project asks for email confirmation and so returned no session. */
export async function signUp(email: string, password: string): Promise<'signedIn' | 'confirmationRequired'> {
  const { data } = await attempt(() => supabase.auth.signUp({ email, password }));
  return data.session ? 'signedIn' : 'confirmationRequired';
}

/** Ends the session. The state change, the cleanups and the redirect to sign-in follow from the auth event. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  // The server could not be reached, but this phone must still forget the account.
  if (error) await supabase.auth.signOut({ scope: 'local' });
}

export type SocialResult = 'signedIn' | 'cancelled';
export type SocialProvider = 'apple' | 'google';
export interface AccountIdentity {
  provider: 'email' | 'apple' | 'google';
  id: string;
}

/** The same email is already registered through another way of signing in. */
function classifySocial(error: { code?: string; name?: string }): AuthFailure {
  switch (error.code) {
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return 'account-exists-other-provider';
    default:
      return classify(error);
  }
}

async function attemptSocial<T extends { error: { code?: string; name?: string } | null }>(call: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch {
    throw new AuthFailed('network');
  }
  if (result.error) throw new AuthFailed(classifySocial(result.error));
  return result;
}

async function credentialFor(provider: SocialProvider): Promise<{ idToken: string; nonce?: string } | null> {
  if (provider === 'apple') {
    if (Platform.OS !== 'ios') throw new AuthFailed('provider-unavailable');
    return getAppleCredential();
  }
  return getGoogleCredential();
}

/** A failure of the native sign-in itself (not a cancel) is reported as 'other'. */
async function credentialOrFail(provider: SocialProvider): ReturnType<typeof credentialFor> {
  try {
    return await credentialFor(provider);
  } catch (error) {
    if (error instanceof AuthFailed) throw error;
    throw new AuthFailed('other');
  }
}

async function socialSignIn(provider: SocialProvider): Promise<SocialResult> {
  const credential = await credentialOrFail(provider);
  if (credential === null) return 'cancelled';
  await attemptSocial(() => supabase.auth.signInWithIdToken({ provider, token: credential.idToken, nonce: credential.nonce }));
  return 'signedIn';
}

export const signInWithApple = (): Promise<SocialResult> => socialSignIn('apple');
export const signInWithGoogle = (): Promise<SocialResult> => socialSignIn('google');

/** Adds a social identity to the signed-in account. */
export async function linkProvider(provider: SocialProvider): Promise<SocialResult> {
  const credential = await credentialOrFail(provider);
  if (credential === null) return 'cancelled';
  await attemptSocial(() => supabase.auth.linkIdentity({ provider, token: credential.idToken, nonce: credential.nonce }));
  return 'signedIn';
}

export async function listIdentities(): Promise<AccountIdentity[]> {
  const { data } = await attempt(() => supabase.auth.getUserIdentities());
  return (data?.identities ?? []).map((identity) => ({
    provider: identity.provider as AccountIdentity['provider'],
    id: identity.identity_id,
  }));
}

/** Removes one way of signing in; the last one cannot be removed. */
export async function unlinkIdentity(id: string): Promise<void> {
  const { data } = await attempt(() => supabase.auth.getUserIdentities());
  const identities = data?.identities ?? [];
  if (identities.length <= 1) throw new AuthFailed('last-identity');
  const identity = identities.find((candidate) => candidate.identity_id === id);
  if (!identity) throw new AuthFailed('other');
  await attempt(() => supabase.auth.unlinkIdentity(identity));
}

export async function sendPasswordReset(email: string): Promise<void> {
  await attempt(() => supabase.auth.resetPasswordForEmail(email));
}

export async function updatePassword(newPassword: string): Promise<void> {
  await attempt(() => supabase.auth.updateUser({ password: newPassword }));
}

/** Signs this account out everywhere except on this phone. */
export async function signOutOthers(): Promise<void> {
  await attempt(() => supabase.auth.signOut({ scope: 'others' }));
}
