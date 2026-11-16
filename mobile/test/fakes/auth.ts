/*
 * A scriptable session. test/setup.ts installs it, signed in, before every test.
 * It stands in twice: as the AuthPort the API layer uses, and (through `supabaseFake`, which
 * nativeModules.ts mounts in place of `@/shared/auth/supabase`) as the Supabase client the
 * real `useSession`, `signIn` and `signOut` talk to. Both views share one state.
 */
import { setAuthPort } from '@/shared/auth/authPort';
import type { AuthPort } from '@/shared/auth/authPort';

interface FakeSession {
  access_token: string;
  user: { id: string; email: string };
}
type Listener = (event: string, session: FakeSession | null) => void;
type Failure = { code: string; name: string; message: string };

export const PASSWORD = 'correct-horse-battery';
/** The code the fake accepts from a password-reset link. */
export const RECOVERY_CODE = 'recovery-code';

export interface FakeAuth {
  readonly port: AuthPort;
  userId: string | null;
  email: string | null;
  token: string | null;
  refreshCalls: number;
  signOutCalls: number;
  /** Whether sign-up answers without a session, as hosted Supabase does when email confirmation is on. */
  confirmationRequired: boolean;
  /** Accounts the fake knows, by email. `reset` seeds owner@, a@ and b@example.com, all with `PASSWORD`. */
  accounts: Map<string, { id: string; password: string }>;
  /** Id-token sign-ins and links the fake received, for checking the provider and nonce. */
  idTokenCalls: { provider: string; token: string; nonce?: string }[];
  /** When set, id-token sign-ins and links answer with this error. */
  idTokenError: Failure | null;
  identities: { provider: string; id: string }[];
  unlinked: string[];
  signOutScopes: (string | undefined)[];
  resetEmails: string[];
  passwords: string[];
  signInAs(id: string, email: string): void;
  /** Nobody is signed in, and nobody is told; for setting up a test. */
  clear(): void;
  /** Later refreshes answer null, as when the refresh token was revoked. */
  failRefresh(): void;
  reset(): void;
}

let generation = 0;
let refuse = false;
const listeners = new Set<Listener>();

const nextToken = (id: string) => `token-${id}-${++generation}`;
const current = (): FakeSession | null =>
  fakeAuth.userId && fakeAuth.token && fakeAuth.email
    ? { access_token: fakeAuth.token, user: { id: fakeAuth.userId, email: fakeAuth.email } }
    : null;
const emit = (event: string) => [...listeners].forEach((listener) => listener(event, current()));
const failure = (code: string, message: string, name = 'AuthApiError'): Failure => ({ code, name, message });

export const fakeAuth: FakeAuth = {
  userId: null,
  email: null,
  token: null,
  refreshCalls: 0,
  signOutCalls: 0,
  confirmationRequired: false,
  accounts: new Map(),
  idTokenCalls: [],
  idTokenError: null,
  identities: [],
  unlinked: [],
  signOutScopes: [],
  resetEmails: [],
  passwords: [],
  port: {
    getAccessToken: async () => fakeAuth.token,
    refresh: async () => {
      fakeAuth.refreshCalls += 1;
      if (refuse || fakeAuth.userId === null) return null;
      fakeAuth.token = nextToken(fakeAuth.userId);
      return fakeAuth.token;
    },
    signOutLocal: async () => {
      fakeAuth.signOutCalls += 1;
      fakeAuth.clear();
      emit('SIGNED_OUT');
    },
  },
  signInAs(id, email) {
    refuse = false;
    fakeAuth.userId = id;
    fakeAuth.email = email;
    fakeAuth.token = nextToken(id);
    emit('SIGNED_IN');
  },
  clear() {
    fakeAuth.userId = null;
    fakeAuth.email = null;
    fakeAuth.token = null;
  },
  failRefresh() {
    refuse = true;
  },
  reset() {
    refuse = false;
    fakeAuth.refreshCalls = 0;
    fakeAuth.signOutCalls = 0;
    fakeAuth.confirmationRequired = false;
    fakeAuth.idTokenCalls = [];
    fakeAuth.idTokenError = null;
    fakeAuth.identities = [{ provider: 'email', id: 'identity-email' }];
    fakeAuth.unlinked = [];
    fakeAuth.signOutScopes = [];
    fakeAuth.resetEmails = [];
    fakeAuth.passwords = [];
    fakeAuth.accounts = new Map([
      ['owner@example.com', { id: 'user-1', password: PASSWORD }],
      ['a@example.com', { id: 'a', password: PASSWORD }],
      ['b@example.com', { id: 'b', password: PASSWORD }],
    ]);
    listeners.clear();
    fakeAuth.signInAs('user-1', 'owner@example.com');
    setAuthPort(fakeAuth.port);
  },
};

/** The part of the supabase-js client that `@/shared/auth/session` uses. */
export const supabaseFake = {
  auth: {
    onAuthStateChange(callback: Listener) {
      listeners.add(callback);
      // supabase-js reports the stored session right after subscribing.
      // (Promise, not queueMicrotask: the router's test renderer fakes the latter.)
      void Promise.resolve().then(() => {
        if (listeners.has(callback)) callback('INITIAL_SESSION', current());
      });
      return { data: { subscription: { unsubscribe: () => void listeners.delete(callback) } } };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const account = fakeAuth.accounts.get(email);
      if (!account || account.password !== password) {
        return { data: { session: null }, error: failure('invalid_credentials', 'Invalid login credentials') };
      }
      fakeAuth.signInAs(account.id, email);
      return { data: { session: current() }, error: null };
    },
    async signUp({ email, password }: { email: string; password: string }) {
      if (fakeAuth.accounts.has(email)) {
        return { data: { session: null }, error: failure('user_already_exists', 'User already registered') };
      }
      const id = `user-${email}`;
      fakeAuth.accounts.set(email, { id, password });
      if (fakeAuth.confirmationRequired) return { data: { session: null }, error: null };
      fakeAuth.signInAs(id, email);
      return { data: { session: current() }, error: null };
    },
    async signOut(options?: { scope?: string }) {
      fakeAuth.signOutScopes.push(options?.scope);
      if (options?.scope === 'others') return { error: null };
      await fakeAuth.port.signOutLocal();
      return { error: null };
    },
    async signInWithIdToken({ provider, token, nonce }: { provider: string; token: string; nonce?: string }) {
      fakeAuth.idTokenCalls.push({ provider, token, nonce });
      if (fakeAuth.idTokenError) return { data: { session: null }, error: fakeAuth.idTokenError };
      fakeAuth.signInAs(`user-${provider}`, `${provider}@example.com`);
      return { data: { session: current() }, error: null };
    },
    async linkIdentity({ provider, token, nonce }: { provider: string; token: string; nonce?: string }) {
      fakeAuth.idTokenCalls.push({ provider, token, nonce });
      if (fakeAuth.idTokenError) return { data: { session: null }, error: fakeAuth.idTokenError };
      fakeAuth.identities.push({ provider, id: `identity-${provider}` });
      return { data: { session: current() }, error: null };
    },
    async getUserIdentities() {
      return { data: { identities: fakeAuth.identities.map((i) => ({ provider: i.provider, identity_id: i.id, id: i.id })) }, error: null };
    },
    async unlinkIdentity(identity: { identity_id: string }) {
      fakeAuth.unlinked.push(identity.identity_id);
      fakeAuth.identities = fakeAuth.identities.filter((i) => i.id !== identity.identity_id);
      return { data: {}, error: null };
    },
    async resetPasswordForEmail(email: string) {
      fakeAuth.resetEmails.push(email);
      return { data: {}, error: null };
    },
    async exchangeCodeForSession(code: string) {
      if (code !== RECOVERY_CODE) return { data: { session: null }, error: failure('flow_state_not_found', 'Invalid flow state') };
      fakeAuth.signInAs('user-1', 'owner@example.com');
      return { data: { session: current() }, error: null };
    },
    async updateUser({ password }: { password?: string }) {
      if (password) fakeAuth.passwords.push(password);
      return { data: { user: {} }, error: null };
    },
  },
};
