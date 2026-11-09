/* The session as the API layer sees it. Task 7 supplies the Supabase-backed implementation. */
export interface AuthPort {
  getAccessToken(): Promise<string | null>;
  /** Resolves the new access token, or null when the session can no longer be refreshed. */
  refresh(): Promise<string | null>;
  signOutLocal(): Promise<void>;
}

const signedOut: AuthPort = {
  getAccessToken: async () => null,
  refresh: async () => null,
  signOutLocal: async () => undefined,
};

let installed: AuthPort = signedOut;

export function setAuthPort(port: AuthPort): void {
  installed = port;
}

/** Forwards to whichever port is installed now, so callers may hold it before setAuthPort runs. */
export const currentAuthPort: AuthPort = {
  getAccessToken: () => installed.getAccessToken(),
  refresh: () => installed.refresh(),
  signOutLocal: () => installed.signOutLocal(),
};
