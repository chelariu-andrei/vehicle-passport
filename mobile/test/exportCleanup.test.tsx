import { File } from 'expo-file-system';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { appLock } from '@/features/account/model/appLock';
import { sweepStaleExport } from '@/features/account/api/useExport';
import { signOut } from '@/shared/auth/session';
import { en } from '@/shared/i18n/en';

import { PASSWORD } from './fakes/auth';
import { openApp } from './harness';
import { putFile } from './fakes/photos';

const inertTabs = { '(tabs)/index': () => null, '(tabs)/scans': () => null, '(tabs)/passports': () => null };
const files = File as unknown as { deleted: string[]; removed: Set<string> };
const EXPORT = 'cache/vehicle-passport-data.json';
const authenticate = LocalAuthentication.authenticateAsync as jest.Mock;
const DAY = 86_400_000;

function badgeValues(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((child) => badgeValues(child, found));
  else if (node && typeof node === 'object') {
    const { props, children } = node as { props?: { badgeValue?: unknown }; children?: unknown };
    if (typeof props?.badgeValue === 'string' && props.badgeValue !== '') found.push(props.badgeValue);
    badgeValues(children, found);
  }
  return found;
}

const openDelete = async () => {
  const fake = await openApp('/account', { routes: inertTabs });
  await fireEvent.press(await screen.findByRole('button', { name: en.account.deleteAccount }));
  await screen.findByText(en.deletion.deletedTitle);
  return fake;
};

test('a leftover export is removed before a new export starts', async () => {
  await openDelete();
  putFile(EXPORT, 100);
  await fireEvent.press(screen.getByRole('button', { name: en.deletion.download }));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
  expect(files.deleted).toContain(EXPORT);
});

test('the export is gone after sign-out', async () => {
  await openApp('/account', { routes: inertTabs });
  await screen.findByRole('button', { name: en.account.deleteAccount });
  putFile(EXPORT, 100);
  await act(async () => {
    await signOut();
  });
  expect(files.deleted).toContain(EXPORT);
});

test('the sweep removes a leftover and never throws', () => {
  putFile(EXPORT, 100);
  sweepStaleExport();
  expect(files.deleted).toContain(EXPORT);
  files.deleted.length = 0;
  files.removed.add(EXPORT);
  expect(() => sweepStaleExport()).not.toThrow();
  expect(files.deleted).toEqual([]);
});

test('the sweep runs when the app opens', async () => {
  putFile(EXPORT, 100);
  await openApp('/account', { routes: inertTabs });
  await waitFor(() => expect(files.deleted).toContain(EXPORT));
});

test('a double tap on confirm asks for biometrics once and schedules once', async () => {
  await appLock.update({ enabled: true, timeout: '1m' });
  authenticate.mockClear();
  let release!: () => void;
  authenticate.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ success: true }))));
  const fake = await openDelete();
  await fireEvent.press(screen.getByRole('checkbox', { name: en.deletion.understand }));
  await fireEvent.press(screen.getByRole('button', { name: en.deletion.action }));
  const confirm = await screen.findByRole('button', { name: en.deletion.sheetConfirm });
  await fireEvent.press(confirm);
  await fireEvent.press(confirm);
  await act(async () => release());
  await waitFor(() => expect(fake.callsTo('scheduleDeletion')).toHaveLength(1));
  expect(authenticate).toHaveBeenCalledTimes(1);
});

test('the next user sees no banner or dot from the previous one', async () => {
  const fake = await openApp('/account', {
    routes: inertTabs,
    seed: (api) => {
      api.state.account.deletion = new Date(Date.now() + 12 * DAY).toISOString();
    },
  });
  expect((await screen.findAllByText(en.deletion.scheduledTitle)).length).toBeGreaterThan(0);
  await act(async () => {
    await signOut();
  });
  await waitFor(() => expect(screen).toHavePathname('/sign-in'));
  // The server answers the new user with no deletion, but only slowly: nothing of the old account may show meanwhile.
  fake.state.account.deletion = null;
  const realFetch = globalThis.fetch;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.endsWith('/me') ? gate.then(() => realFetch(input, init)) : realFetch(input, init);
  }) as typeof fetch;
  await fireEvent.changeText(screen.getByLabelText(en.auth.email), 'owner@example.com');
  await fireEvent.changeText(screen.getByLabelText(en.auth.password), PASSWORD);
  await fireEvent.press(screen.getByRole('button', { name: en.auth.signInAction }));
  await act(async () => {});
  expect(screen.queryByText(en.deletion.scheduledTitle)).toBeNull();
  expect(badgeValues(screen.toJSON())).toEqual([]);
  await act(async () => open());
  await waitFor(() => expect(screen).not.toHavePathname('/sign-in'));
  expect(screen.queryByText(en.deletion.scheduledTitle)).toBeNull();
  expect(badgeValues(screen.toJSON())).toEqual([]);
  globalThis.fetch = realFetch;
});

test('the deleted card does not claim consents go, and the kept-anonymously line says what stays', async () => {
  await openDelete();
  expect(en.deletion.deletedBody).not.toMatch(/consent/i);
  expect(screen.getByText(en.deletion.keptAnonymous)).toBeTruthy();
});
