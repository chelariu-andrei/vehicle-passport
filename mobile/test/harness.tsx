/* Opens the real app (router, providers, session) against the fake API. Every steps file starts here. */
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { autoJourney } from '@/features/vehicle';
import { en } from '@/shared/i18n/en';

import { fakeAuth } from './fakes/auth';
import { CURRENT_LEGAL_VERSION } from './fake-api/account';
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
  /** Lets the journey start by itself in an empty garage. Off by default so a screen test of the empty Car tab stays on it. */
  autoJourney?: boolean;
}

const inert = () => null;

/** The Car, Scans and Passports tabs all mount and all carry the active car's name. Only the tab the URL is about stays real, so a screen's text and buttons are not found twice; a test passes its own `routes` to override. */
function neighbourTabs(url: string): Routes {
  const owner = url.startsWith('/scans') ? '(tabs)/scans' : url.startsWith('/passports') ? '(tabs)/passports' : '(tabs)/index';
  return Object.fromEntries(['(tabs)/index', '(tabs)/scans', '(tabs)/passports'].filter((r) => r !== owner).map((r) => [r, inert]));
}

export async function openApp(url: string, opts: OpenAppOptions = {}): Promise<FakeApi> {
  const api = installFakeApi();
  // The consent gate is off unless a scenario's seed takes the acceptance away.
  api.state.account.accepted = { terms: CURRENT_LEGAL_VERSION, privacy: CURRENT_LEGAL_VERSION };
  opts.seed?.(api);
  if (opts.autoJourney) autoJourney.reset();
  else autoJourney.dismiss();
  if (opts.as === null) fakeAuth.clear();
  else if (opts.as) fakeAuth.signInAs(opts.as.id, opts.as.email);
  await renderRouter({ appDir: './app', overrides: { ...neighbourTabs(url), ...opts.routes } }, { initialUrl: url });
  return api;
}

/** The app is opened again on the same phone: storage and the fake API stay, every in-memory cache starts empty (the first tree is left to the test cleanup; unmounting it breaks the next test's render). */
export async function reopenApp(url: string): Promise<void> {
  await renderRouter({ appDir: './app', overrides: neighbourTabs(url) }, { initialUrl: url });
}

/** Opens the add-a-car journey from the Car tab, the way a person does: the empty state's action, else the car list. */
export async function openJourney() {
  const direct = screen.queryByRole('button', { name: en.cars.add });
  if (direct) {
    await fireEvent.press(direct);
  } else {
    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`${en.cars.switch}$`) }));
    await fireEvent.press(await screen.findByRole('button', { name: en.cars.add }));
  }
  await screen.findByText(en.journey.vinTitle);
}

/** Types a VIN on step 1 and continues to step 2. */
export async function typeVinAndContinue(vin: string) {
  await fireEvent.changeText(await screen.findByLabelText(en.vehicleForm.vin), vin);
  await fireEvent.press(screen.getByRole('button', { name: en.journey.continue }));
  await screen.findByText(en.journey.detailsTitle);
}

/** Fills step 2 and presses "Add to my garage". */
export async function submitDetails(details: { make?: string; model?: string } = {}) {
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.make), details.make ?? 'Volkswagen');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.model), details.model ?? 'Golf');
  await fireEvent.changeText(screen.getByLabelText(en.vehicleForm.year), '2015');
  await fireEvent.press(screen.getByRole('radio', { name: en.fuel.DIESEL }));
  await fireEvent.press(screen.getByRole('button', { name: en.journey.submit }));
}

/** Opens the journey and walks both steps for `vin`: a Volkswagen Golf, 2015, diesel. */
export async function registerVin(vin: string) {
  await openJourney();
  await typeVinAndContinue(vin.toLowerCase());
  await submitDetails();
}
