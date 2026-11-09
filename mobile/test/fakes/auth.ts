/* A scriptable session. test/setup.ts installs it, signed in, before every test. */
import { setAuthPort } from '@/shared/auth/authPort';
import type { AuthPort } from '@/shared/auth/authPort';

export interface FakeAuth {
  readonly port: AuthPort;
  userId: string | null;
  email: string | null;
  token: string | null;
  refreshCalls: number;
  signOutCalls: number;
  signInAs(id: string, email: string): void;
  /** Later refreshes answer null, as when the refresh token was revoked. */
  failRefresh(): void;
  reset(): void;
}

let generation = 0;
let refuse = false;

const nextToken = (id: string) => `token-${id}-${++generation}`;

export const fakeAuth: FakeAuth = {
  userId: null,
  email: null,
  token: null,
  refreshCalls: 0,
  signOutCalls: 0,
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
      fakeAuth.userId = null;
      fakeAuth.email = null;
      fakeAuth.token = null;
    },
  },
  signInAs(id, email) {
    refuse = false;
    fakeAuth.userId = id;
    fakeAuth.email = email;
    fakeAuth.token = nextToken(id);
  },
  failRefresh() {
    refuse = true;
  },
  reset() {
    refuse = false;
    fakeAuth.refreshCalls = 0;
    fakeAuth.signOutCalls = 0;
    fakeAuth.signInAs('user-1', 'owner@example.com');
    setAuthPort(fakeAuth.port);
  },
};
