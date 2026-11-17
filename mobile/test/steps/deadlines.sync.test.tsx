import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { AppState, Platform } from 'react-native';

import { formatLocalDate } from '@/features/event';
import { signOut } from '@/shared/auth/session';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { fakeAuth } from '../fakes/auth';
import { openApp, reopenApp } from '../harness';

/* The phone's notification centre, in memory: what is scheduled now, and what the system permission is. */
type Request = Parameters<typeof Notifications.scheduleNotificationAsync>[0];
type Payload = { vin: string; kind: string };
let pending: Request[] = [];
let system: 'granted' | 'denied' | 'undetermined' = 'granted';
const mocked = jest.mocked(Notifications);
const answer = (status: typeof system) => ({ status, granted: status === 'granted', canAskAgain: status === 'undetermined', expires: 'never' }) as never;

const OTHER_VIN = 'UU1HSDAN123456789';
const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};
const rca = (validUntil: string, validFrom = '2025-01-01') =>
  anEvent({
    type: 'INSURANCE',
    date: validFrom,
    validFrom,
    validUntil,
    details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz', policyNumber: null } as never,
  });
const twoCars = (api: FakeApi) => {
  api.state.vehicles.push(aVehicle(), aVehicle({ vin: OTHER_VIN, make: 'Dacia', model: 'Duster' }));
  api.state.events[SAMPLE_VIN] = [rca(plusDays(100))];
  api.state.events[OTHER_VIN] = [rca(plusDays(50))];
};

const payloads = () => pending.map((r) => r.content.data as Payload);
const vinsScheduled = () => [...new Set(payloads().map((d) => d.vin))].sort();
const expiryDayOf = (validUntil: string) => {
  const [y, m, d] = validUntil.split('-').map(Number);
  return new Date(y, m - 1, d, 9, 0, 0).getTime();
};
const fireTimes = () => pending.map((r) => ((r.trigger as { date: Date }).date as Date).getTime());

/* Every screen but the one a test opens stays inert, so only the sync asks for the documents. */
const inert = () => null;
const quietTabs = { '(tabs)/index': inert, '(tabs)/scans': inert, '(tabs)/passports': inert };

/* The app's AppState subscriptions, so a test can send it to the background and back. */
type Handler = (state: string) => void;
const appStateHandlers: Handler[] = [];

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  pending = [];
  system = 'granted';
  mocked.cancelAllScheduledNotificationsAsync.mockImplementation(async () => {
    pending = [];
  });
  mocked.scheduleNotificationAsync.mockImplementation(async (request) => {
    pending.push(request);
    return `id-${pending.length}`;
  });
  mocked.getPermissionsAsync.mockImplementation(async () => answer(system));
  mocked.requestPermissionsAsync.mockImplementation(async () => {
    system = 'granted';
    return answer(system);
  });
  appStateHandlers.length = 0;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, handler: Handler) => {
    if (type === 'change') appStateHandlers.push(handler);
    return {
      remove: () => {
        const at = appStateHandlers.indexOf(handler);
        if (at >= 0) appStateHandlers.splice(at, 1);
      },
    };
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

it('signing in schedules reminders for every car in the garage', async () => {
  await openApp('/', { as: null, seed: twoCars, routes: quietTabs });
  expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  await act(async () => fakeAuth.signInAs('user-1', 'owner@example.com'));

  await waitFor(() => expect(vinsScheduled()).toEqual([OTHER_VIN, SAMPLE_VIN].sort()));
  // Four document reminders (30, 7, 1 days and the expiry day) and two tire-season reminders per car.
  expect(pending).toHaveLength(12);
  expect(pending.map((r) => r.content.title)).toContain(en.deadlines.notification.title('RCA', 0));
  expect(pending.map((r) => r.content.body)).toContain(en.deadlines.notification.body('Dacia Duster'));
  expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
});

it('a re-render with the same plan does not schedule again', async () => {
  const fake = await openApp('/', { seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(pending).toHaveLength(12));
  const scheduledOnce = mocked.scheduleNotificationAsync.mock.calls.length;
  // The same documents come back from the server: nothing to reschedule.
  const before = fake.callsTo('getDeadlines').length;
  await act(async () => appStateHandlers.forEach((h) => h('active')));
  await waitFor(() => expect(fake.callsTo('getDeadlines').length).toBeGreaterThan(before));
  await act(async () => undefined);
  expect(mocked.scheduleNotificationAsync.mock.calls.length).toBe(scheduledOnce);
});

it('saving a renewed RCA reschedules and the old expiry-day reminder is gone', async () => {
  const oldUntil = plusDays(10);
  const fake = await openApp(`/vehicles/${SAMPLE_VIN}/events/new?type=INSURANCE&coverage=RCA`, {
    seed: (api) => {
      api.state.vehicles.push(aVehicle());
      api.state.events[SAMPLE_VIN] = [rca(oldUntil)];
    },
    routes: quietTabs,
  });
  await waitFor(() => expect(fireTimes()).toContain(expiryDayOf(oldUntil)));

  await fireEvent.changeText(await screen.findByLabelText(en.event.insurer), 'Groupama');
  await fireEvent.changeText(screen.getByLabelText(en.event.cost), '900');
  await fireEvent.press(screen.getByRole('checkbox', { name: en.event.presetMonths(12) }));
  await fireEvent.press(await screen.findByRole('button', { name: en.event.save }));
  await fireEvent.press(await screen.findByRole('button', { name: en.event.check.confirm }));
  await waitFor(() => expect(fake.callsTo('addEvent')).toHaveLength(1));
  const newUntil = (fake.callsTo('addEvent')[0].body as { validUntil: string }).validUntil;

  await waitFor(() => expect(fireTimes()).toContain(expiryDayOf(newUntil)));
  expect(fireTimes()).not.toContain(expiryDayOf(oldUntil));
});

it('releasing a car removes its reminders', async () => {
  // Jest's iOS Modal never reports a dismissal; the menu's Android timer path stands in for it.
  jest.replaceProperty(Platform, 'OS', 'android');
  await openApp('/', { seed: twoCars });
  await waitFor(() => expect(vinsScheduled()).toEqual([OTHER_VIN, SAMPLE_VIN].sort()));

  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.more }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.release }));
  await fireEvent.press(await screen.findByRole('button', { name: en.vehicle.releaseConfirm }));

  await waitFor(() => expect(vinsScheduled()).toHaveLength(1));
  expect(pending.length).toBeGreaterThan(0);
});

it('signing out cancels all', async () => {
  await openApp('/', { seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(pending).toHaveLength(12));
  mocked.cancelAllScheduledNotificationsAsync.mockClear();

  await act(async () => {
    await signOut();
  });

  await waitFor(() => expect(screen).toHavePathname('/sign-in'));
  await waitFor(() => expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled());
  expect(pending).toEqual([]);
});

it('opening the app signed out (a session lost while it was closed) cancels what an account left behind', async () => {
  pending = [{ content: { title: 'left over' }, trigger: null }];
  await openApp('/', { as: null, seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(screen).toHavePathname('/sign-in'));
  await waitFor(() => expect(pending).toEqual([]));
  expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('denied permission schedules nothing and shows no sheet', async () => {
  system = 'denied';
  const fake = await openApp('/', { seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(mocked.getPermissionsAsync).toHaveBeenCalled());
  await waitFor(() => expect(fake.callsTo('getSettings').length).toBeGreaterThan(0));
  await act(async () => undefined);

  expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  // Nothing is loaded for reminders that cannot reach the owner.
  expect(fake.callsTo('getDeadlines')).toHaveLength(0);
  expect(fake.callsTo('getTimeline')).toHaveLength(0);
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(screen.queryByText(en.deadlines.permission.title)).toBeNull();
});

it('undetermined permission shows the explanation sheet once, and not again after Not now', async () => {
  system = 'undetermined';
  await openApp('/', { seed: twoCars, routes: quietTabs });
  expect(await screen.findByText(en.deadlines.permission.title)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: en.deadlines.permission.notNow }));
  await waitFor(() => expect(screen.queryByText(en.deadlines.permission.title)).toBeNull());
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();

  await reopenApp('/');
  await waitFor(() => expect(mocked.getPermissionsAsync.mock.calls.length).toBeGreaterThan(1));
  await act(async () => undefined);
  expect(screen.queryByText(en.deadlines.permission.title)).toBeNull();
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('Allow reminders requests the system permission after the sheet, then schedules', async () => {
  system = 'undetermined';
  await openApp('/', { seed: twoCars, routes: quietTabs });
  await screen.findByText(en.deadlines.permission.title);
  expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: en.deadlines.permission.allow }));

  await waitFor(() => expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(pending).toHaveLength(12));
  expect(screen.queryByText(en.deadlines.permission.title)).toBeNull();
});

it('turning document deadlines off leaves only tire reminders, and both off cancels all', async () => {
  await openApp('/account/notifications', { seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(pending).toHaveLength(12));

  await fireEvent(await screen.findByRole('switch', { name: en.settings.notifications.documentDeadlines }), 'valueChange', false);
  await waitFor(() => expect(pending).toHaveLength(4));
  expect(payloads().every((d) => d.kind.startsWith('TIRE_'))).toBe(true);

  mocked.cancelAllScheduledNotificationsAsync.mockClear();
  await fireEvent(await screen.findByRole('switch', { name: en.settings.notifications.tireSeason }), 'valueChange', false);
  await waitFor(() => expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled());
  expect(pending).toEqual([]);
});

it('without accepted terms nothing is scheduled and old reminders are cancelled', async () => {
  pending = [{ content: { title: 'left over' }, trigger: null }];
  await openApp('/', {
    seed: (api) => {
      twoCars(api);
      api.state.account.accepted = { terms: null, privacy: null };
    },
    routes: quietTabs,
  });
  await waitFor(() => expect(screen).toHavePathname('/consent'));
  await waitFor(() => expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled());
  expect(pending).toEqual([]);
  expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('app returning to the foreground refetches deadlines', async () => {
  const fake = await openApp('/', { seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(pending).toHaveLength(12));
  expect(fake.callsTo('getDeadlines')).toHaveLength(2);

  await act(async () => appStateHandlers.forEach((h) => h('background')));
  await act(async () => appStateHandlers.forEach((h) => h('active')));

  await waitFor(() => expect(fake.callsTo('getDeadlines')).toHaveLength(4));
});

it('notifications allowed in the phone settings while away are used on return', async () => {
  system = 'denied';
  await openApp('/', { seed: twoCars, routes: quietTabs });
  await waitFor(() => expect(mocked.getPermissionsAsync).toHaveBeenCalled());
  const permissionReads = mocked.getPermissionsAsync.mock.calls.length;

  system = 'granted';
  await act(async () => appStateHandlers.forEach((h) => h('background')));
  await act(async () => appStateHandlers.forEach((h) => h('active')));

  expect(mocked.getPermissionsAsync.mock.calls.length).toBeGreaterThan(permissionReads);
  await waitFor(() => expect(pending).toHaveLength(12));
});
