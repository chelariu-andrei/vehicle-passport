/* Opens the real app (router, providers, session) against the fake API. Every steps file starts here. */
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

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

/** The app is opened again on the same phone: storage and the fake API stay, every in-memory cache starts empty (the first tree is left to the test cleanup; unmounting it breaks the next test's render). */
export async function reopenApp(url: string): Promise<void> {
  await renderRouter({ appDir: './app', overrides: {} }, { initialUrl: url });
}

/** Opens the Add vehicle sheet. The "Add a car" actions go to `/onboarding` (Task 10); until it replaces this form they cannot reach it. */
export async function openAddVehicle() {
  await act(async () => router.push('/vehicles/new'));
}

/** Opens the Add vehicle sheet and submits a valid form for `vin`. */
export async function registerVin(vin: string) {
  await openAddVehicle();
  await fireEvent.changeText(await screen.findByLabelText(en.vehicleForm.vin), vin.toLowerCase());
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.make), 'Volkswagen');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), 'Golf');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.year), '2015');
  await fireEvent.press(screen.getByRole('radio', { name: en.fuel.DIESEL }));
  await fireEvent.press(screen.getByRole('button', { name: en.vehicleForm.submit }));
}
