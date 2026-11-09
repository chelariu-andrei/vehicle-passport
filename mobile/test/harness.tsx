/* Opens the real app (router, providers, session) against the fake API. Every steps file starts here. */
import { renderRouter } from 'expo-router/testing-library';

import { fakeAuth } from './fakes/auth';
import { installFakeApi } from './fake-api';
import type { FakeApi } from './fake-api';

type Routes = Record<string, (() => React.ReactElement | null) | { default: () => React.ReactElement | null }>;

export interface OpenAppOptions {
  /** The signed-in account. Omitted: the session stays as the test left it (the default fake account unless changed). `null`: nobody is signed in. */
  as?: { id: string; email: string } | null;
  /** Fills the fake API before the first render, so the app's first request already sees it. */
  seed?(api: FakeApi): void;
  /** Replaces route files (keys like `(tabs)/index`), for screens a later task has not built yet. */
  routes?: Routes;
}

export async function openApp(url: string, opts: OpenAppOptions = {}): Promise<FakeApi> {
  const api = installFakeApi();
  opts.seed?.(api);
  if (opts.as === null) fakeAuth.clear();
  else if (opts.as) fakeAuth.signInAs(opts.as.id, opts.as.email);
  await renderRouter({ appDir: './app', overrides: opts.routes ?? {} }, { initialUrl: url });
  return api;
}
