/* Opens the real app (router, providers, session) against the fake API. Every steps file starts here. */
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { en } from '@/shared/i18n/en';

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

/** Opens the Add vehicle sheet from the garage and submits a valid form for `vin`. */
export async function registerVin(vin: string) {
  await fireEvent.press(screen.getByRole('button', { name: en.garage.addVehicle }));
  await fireEvent.changeText(await screen.findByLabelText(en.vehicleForm.vin), vin.toLowerCase());
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.make), 'Volkswagen');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), 'Golf');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.year), '2015');
  await fireEvent.press(screen.getByRole('radio', { name: en.fuel.DIESEL }));
  await fireEvent.press(screen.getByRole('button', { name: en.vehicleForm.submit }));
}
