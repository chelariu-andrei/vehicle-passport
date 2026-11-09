/* Who is signed in, and what must happen when they are not any more. */
import { useSyncExternalStore } from 'react';

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

export type AuthFailure = 'invalid-credentials' | 'email-taken' | 'weak-password' | 'network' | 'other';

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
