import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';

import { formatLocalDate } from '@/features/event';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/deadlines.feature', { loadRelativePath: true });

const url = `/vehicles/${SAMPLE_VIN}/deadlines`;
const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};
const rca = (validUntil: string, id?: string) =>
  anEvent({
    ...(id ? { id } : {}),
    type: 'INSURANCE',
    date: '2025-01-01',
    validFrom: '2025-01-01',
    validUntil,
    details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz', policyNumber: null } as never,
  });

let seed: (api: FakeApi) => void = () => undefined;

beforeEach(async () => {
  await AsyncStorage.clear();
  seed = () => undefined;
});

const withEvents = (...events: ReturnType<typeof anEvent>[]) => {
  seed = (api) => {
    api.state.vehicles.push(aVehicle());
    api.state.events[SAMPLE_VIN] = events;
  };
};

const open = async () => {
  await openApp(url, { seed });
  await screen.findByText(en.deadlines.title);
};

const row = (kind: keyof typeof en.deadlines.kind) => screen.findByTestId(`deadline-row-${kind}`);

defineFeature(feature, (test) => {
  test('A fresh car shows six documents, none of them an offence', ({ given, when, then, and }) => {
    given('a car with no documents recorded', () => withEvents());
    when('I open Document status', open);
    then('I see the six documents in order ITP, RCA, CASCO, Rovinietă, Fire extinguisher, First-aid kit', async () => {
      const rows = await screen.findAllByTestId(/^deadline-row-/);
      expect(rows.map((r) => r.props.testID)).toEqual(
        ['ITP', 'RCA', 'CASCO', 'ROVINIETA', 'FIRE_EXTINGUISHER', 'FIRST_AID_KIT'].map((k) => `deadline-row-${k}`),
      );
    });
    and('every one of them reads "Not added"', async () => {
      const rows = await screen.findAllByTestId(/^deadline-row-/);
      rows.forEach((r) => expect(within(r).getByText(en.deadlines.status.NOT_RECORDED)).toBeTruthy());
    });
  });

  test('An expiring document shows its date and the days left', ({ given, when, then }) => {
    given('an RCA valid for another 12 days', () => withEvents(rca(plusDays(12))));
    when('I open Document status', open);
    then('the RCA reads "Expiring" with "12 days"', async () => {
      const r = await row('RCA');
      expect(within(r).getByText(en.deadlines.status.EXPIRING)).toBeTruthy();
      expect(within(r).getByText(/12 days/)).toBeTruthy();
    });
  });

  test('An expired document says how long ago', ({ given, when, then }) => {
    given('an RCA that expired 3 days ago', () => withEvents(rca(plusDays(-3))));
    when('I open Document status', open);
    then('the RCA reads "Expired" with "expired 3 days ago"', async () => {
      const r = await row('RCA');
      expect(within(r).getByText(en.deadlines.status.EXPIRED)).toBeTruthy();
      expect(within(r).getByText('expired 3 days ago')).toBeTruthy();
    });
  });

  test('CASCO is optional', ({ given, when, then }) => {
    given('a car with no documents recorded', () => withEvents());
    when('I open Document status', open);
    then('the CASCO row reads "Optional · Add"', async () => {
      expect(within(await row('CASCO')).getByText(en.deadlines.optionalAdd)).toBeTruthy();
      expect(within(await row('RCA')).getByText(en.deadlines.add)).toBeTruthy();
    });
  });

  test('Adding a missing document opens the form with it chosen', ({ given, when, then }) => {
    given('a car with no documents recorded', () => withEvents());
    when('I tap the RCA row', async () => {
      await open();
      await fireEvent.press(await row('RCA'));
    });
    then('the new event form opens for an RCA insurance', async () => {
      await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/events/new`));
      expect(screen).toHaveSearchParams({ vin: SAMPLE_VIN, type: 'INSURANCE', coverage: 'RCA' });
    });
  });

  test('A recorded document opens its entry', ({ given, when, then }) => {
    const id = '11111111-1111-4111-8111-111111111111';
    given('an RCA valid for another 100 days', () => withEvents(rca(plusDays(100), id)));
    when('I tap the RCA row', async () => {
      await open();
      await fireEvent.press(await row('RCA'));
    });
    then("that event's details open", async () => {
      await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/events/${id}`));
    });
  });

  test('The footer shows the reminder days', ({ given, when, then, and }) => {
    given('reminders are on for 30, 7 and 1 days', () => withEvents());
    when('I open Document status', open);
    then('I read "Reminders: 30, 7 and 1 day before, and on the expiry day"', async () => {
      expect(await screen.findByText('Reminders: 30, 7 and 1 day before, and on the expiry day')).toBeTruthy();
    });
    and('"Notification settings" opens the notifications screen', async () => {
      await fireEvent.press(screen.getByRole('button', { name: en.deadlines.settingsButton }));
      await waitFor(() => expect(screen).toHavePathname('/account/notifications'));
    });
  });

  test('Reminders are off', ({ given, when, then }) => {
    given('document deadlines are switched off', () => {
      seed = (api) => {
        api.state.vehicles.push(aVehicle());
        api.state.events[SAMPLE_VIN] = [];
        api.state.account.settings.notifications.documentDeadlines = false;
      };
    });
    when('I open Document status', open);
    then('I read "Reminders are off"', async () => {
      expect(await screen.findByText(en.deadlines.footerOff)).toBeTruthy();
    });
  });

  test('The status fails to load', ({ given, when, then }) => {
    given('the status request fails once', () => {
      seed = (api) => {
        api.state.vehicles.push(aVehicle());
        api.state.events[SAMPLE_VIN] = [];
        api.failNext('getDeadlines', 500, null);
      };
    });
    when('I open Document status', async () => {
      await openApp(url, { seed });
    });
    then('I can retry and then see the six documents', async () => {
      await fireEvent.press(await screen.findByRole('button', { name: en.common.retry }));
      expect((await screen.findAllByTestId(/^deadline-row-/)).length).toBe(6);
    });
  });
});
