import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { defineFeature, loadFeature, setJestCucumberConfiguration } from 'jest-cucumber';
import { StyleSheet } from 'react-native';

import { EVENT_TYPE_CONFIG, formatLocalDate, lockedEvents } from '@/features/event';
import { tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

setJestCucumberConfiguration({ errors: true });
const feature = loadFeature('../../features/timeline-full.feature', { loadRelativePath: true });

let fake: FakeApi;

const carUrl = `/vehicles/${SAMPLE_VIN}`;
const timelineUrl = `${carUrl}/timeline`;
const carTitle = en.timeline.title('Volkswagen Golf');

beforeEach(async () => {
  await AsyncStorage.clear();
  lockedEvents.clear();
});

const withEvents = (...events: ReturnType<typeof anEvent>[]) => (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
  api.state.events[SAMPLE_VIN] = events;
};

/** Opens the full timeline and waits for its first rows. */
async function openTimeline(seed: (api: FakeApi) => void) {
  fake = await openApp(timelineUrl, { seed });
  await screen.findByText(carTitle);
}

const lastCall = (operationId: string) => {
  const calls = fake.callsTo(operationId);
  return calls[calls.length - 1]?.path ?? '';
};

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** Opens a filter sheet, ticks `option` and closes it again. */
async function chooseIn(chip: string, option: string) {
  await press(new RegExp(`^${chip}`));
  await fireEvent.press(await screen.findByRole('checkbox', { name: option }));
  await press(en.common.done);
}

const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};

defineFeature(feature, (test) => {
  test('The compact history opens the full timeline', ({ given, when, then }) => {
    given('a car with events', () => undefined);
    when(/^I tap "(.*)" next to History$/, async (label: string) => {
      fake = await openApp(carUrl, { seed: withEvents(anEvent({ details: { kind: 'SCAN', serviceName: 'Oil change' } })) });
      await fireEvent.press(await screen.findByRole('button', { name: label }));
    });
    then('the Timeline screen opens for that car', async () => {
      await waitFor(() => expect(screen).toHavePathname(timelineUrl));
      expect(await screen.findByText(carTitle)).toBeTruthy();
      expect(await screen.findByText('Oil change')).toBeTruthy();
    });
  });

  test('Events sit on a rail, newest first, grouped by year', ({ given, when, then, and }) => {
    let seed: (api: FakeApi) => void;
    given('the API returns events from 2024 and 2026', () => {
      seed = withEvents(
        anEvent({ type: 'SERVICE', date: '2024-05-02', odometerKm: 90000, details: { kind: 'SCAN', serviceName: 'Old service' } }),
        anEvent({ type: 'REPAIR', date: '2026-02-02', odometerKm: 98400, evidence: 'DOCUMENTED', details: { kind: 'SCAN', serviceName: 'New repair' } }),
      );
    });
    when('I open the full timeline', async () => {
      await openTimeline(seed);
      expect(await screen.findAllByTestId('timeline-item')).toHaveLength(2);
    });
    then('I see the 2026 group above 2024', () => {
      const headers = screen.getAllByTestId('timeline-year');
      expect(headers).toHaveLength(2);
      expect(within(headers[0]).getByRole('header', { name: '2026' })).toBeTruthy();
      expect(within(headers[1]).getByRole('header', { name: '2024' })).toBeTruthy();
      const items = screen.getAllByTestId('timeline-item');
      expect(within(items[0]).getByText('New repair')).toBeTruthy();
      expect(within(items[1]).getByText('Old service')).toBeTruthy();
      for (const call of fake.callsTo('getTimeline')) {
        expect(call.path).toContain('order=desc');
        expect(call.path).toContain('limit=20');
      }
    });
    and('each event has a dot in its type colour on the rail', () => {
      // The rail is decoration for screen readers (the row says the type and evidence), so it is looked up among hidden elements.
      const dots = screen.getAllByTestId('timeline-rail-dot', { includeHiddenElements: true });
      expect(dots).toHaveLength(2);
      const colourOf = (type: 'SERVICE' | 'REPAIR') => [tokens.color.dark, tokens.color.light].map((c) => c[EVENT_TYPE_CONFIG[type].tint]);
      expect(colourOf('REPAIR')).toContain(StyleSheet.flatten(dots[0].props.style).backgroundColor);
      expect(colourOf('SERVICE')).toContain(StyleSheet.flatten(dots[1].props.style).backgroundColor);
      // The documented repair wears a ring; the confirmed service does not.
      expect(screen.getAllByTestId('timeline-rail-ring', { includeHiddenElements: true })).toHaveLength(1);
    });
  });

  test('Picking a year filters the list and the summary', ({ given, when, then }) => {
    given('the summary lists years 2026, 2025', async () => {
      await openTimeline(withEvents(anEvent({ date: '2025-04-01' }), anEvent({ date: '2026-03-01', odometerKm: 90000 })));
      expect(await screen.findByRole('button', { name: '2026' })).toBeTruthy();
      expect(screen.getByRole('button', { name: '2025' })).toBeTruthy();
      expect(screen.getByRole('button', { name: en.timeline.allYears })).toBeTruthy();
    });
    when(/^I pick (\d+)$/, async (year: string) => {
      await press(year);
    });
    then(/^the timeline and the summary are requested with from=(\S+) and to=(\S+)$/, async (from: string, to: string) => {
      await waitFor(() => {
        expect(lastCall('getTimeline')).toContain(`from=${from}`);
        expect(lastCall('getTimeline')).toContain(`to=${to}`);
        expect(lastCall('getTimelineSummary')).toContain(`from=${from}`);
        expect(lastCall('getTimelineSummary')).toContain(`to=${to}`);
      });
      expect(screen.getByRole('button', { name: '2025' })).toBeSelected();
      await waitFor(() => expect(screen.getAllByTestId('timeline-item')).toHaveLength(1));
    });
  });

  test('Type and component filters combine', ({ when, then, and }) => {
    when('I filter by type Insurance and component Brakes', async () => {
      await openTimeline(withEvents(anEvent({ type: 'REPAIR', components: ['BRAKES'] })));
      await chooseIn(en.timeline.type, en.event.type.INSURANCE);
      await chooseIn(en.timeline.component, en.event.component.BRAKES);
    });
    then('the requests carry type=INSURANCE and component=BRAKES', async () => {
      await waitFor(() => {
        for (const op of ['getTimeline', 'getTimelineSummary']) {
          expect(lastCall(op)).toContain('type=INSURANCE');
          expect(lastCall(op)).toContain('component=BRAKES');
        }
      });
    });
    and('the filter chips show their counts', () => {
      expect(screen.getByRole('button', { name: `${en.timeline.type}, 1` })).toBeSelected();
      expect(screen.getByRole('button', { name: `${en.timeline.component}, 1` })).toBeSelected();
      expect(screen.getByRole('button', { name: en.timeline.period })).not.toBeSelected();
    });
  });

  test('Nothing matches', ({ given, then, and }) => {
    given('the filtered timeline is empty', async () => {
      await openTimeline(withEvents(anEvent({ type: 'SERVICE', details: { kind: 'SCAN', serviceName: 'Oil change' } })));
      expect(await screen.findByText('Oil change')).toBeTruthy();
      await chooseIn(en.timeline.type, en.event.type.ITP);
    });
    then(/^I see "(.*)"$/, async (text: string) => {
      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.queryByText(en.vehicle.noHistoryTitle)).toBeNull();
    });
    and(/^"(.*)" resets every filter$/, async (label: string) => {
      await press(label);
      expect(await screen.findByText('Oil change')).toBeTruthy();
      expect(lastCall('getTimeline')).not.toContain('type=');
      expect(lastCall('getTimelineSummary')).not.toContain('type=');
      expect(screen.getByRole('button', { name: en.timeline.type })).not.toBeSelected();
      expect(screen.getByRole('button', { name: en.timeline.allYears })).toBeSelected();
    });
  });

  test('Costs per currency', ({ given, then }) => {
    given(/^the summary has (\d+) RON and (\d+) EUR$/, async (ron: string, eur: string) => {
      await openTimeline(
        withEvents(
          anEvent({ date: '2025-01-10', odometerKm: 90000, costAmount: Number(ron) - 50, currency: 'RON' }),
          anEvent({ date: '2025-02-10', odometerKm: 91000, costAmount: 50, currency: 'RON' }),
          anEvent({ date: '2025-03-10', odometerKm: 92000, costAmount: Number(eur), currency: 'EUR' }),
        ),
      );
    });
    then(/^the summary card shows "(.*)"$/, async (text: string) => {
      const card = await screen.findByTestId('timeline-summary');
      expect(await within(card).findByText(text)).toBeTruthy();
      expect(within(card).getByText(en.timeline.eventCount(3))).toBeTruthy();
      expect(within(card).getByText(en.timeline.km('2 000'))).toBeTruthy();
    });
  });

  test('Kilometres not known', ({ given, then }) => {
    given('the summary distance is empty', async () => {
      await openTimeline(withEvents(anEvent({ date: '2025-01-10', odometerKm: 90000 })));
    });
    then(/^the card shows "(.*)" with "(.*)"$/, async (dash: string, hint: string) => {
      const card = await screen.findByTestId('timeline-summary');
      expect(await within(card).findByText(dash)).toBeTruthy();
      expect(within(card).getByText(hint)).toBeTruthy();
    });
  });

  test('The summary fails but the list works', ({ given, then, and }) => {
    given('the summary request fails', async () => {
      const seed = withEvents(anEvent({ details: { kind: 'SCAN', serviceName: 'Oil change' } }));
      await openTimeline((api) => {
        seed(api);
        api.failNext('getTimelineSummary', 500, 'internal-error');
      });
    });
    then('the summary card offers retry', async () => {
      const card = await screen.findByTestId('timeline-summary');
      expect(await within(card).findByText(en.timeline.summaryFailed)).toBeTruthy();
      await fireEvent.press(within(card).getByRole('button', { name: en.common.retry }));
      expect(await within(card).findByText(en.timeline.eventCount(1))).toBeTruthy();
    });
    and('the events are still listed', () => {
      expect(screen.getByText('Oil change')).toBeTruthy();
    });
  });

  test('Only the current policy shows a marker', ({ given, then }) => {
    given('an RCA marked SUPERSEDED and an RCA marked EXPIRING in 12 days', async () => {
      const rca = (date: string, validUntil: string) =>
        anEvent({ type: 'INSURANCE', date, odometerKm: null, validFrom: date, validUntil, details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz' } });
      await openTimeline(withEvents(rca('2024-01-05', plusDays(40)), rca(plusDays(-200), plusDays(12))));
      expect(await screen.findAllByTestId('timeline-item')).toHaveLength(2);
    });
    then(/^only the newer RCA shows "(.*)"$/, (text: string) => {
      const items = screen.getAllByTestId('timeline-item');
      expect(within(items[0]).getByText(text)).toBeTruthy();
      expect(within(items[1]).queryByText(/^(Valid until|Expires in|Expired)/)).toBeNull();
      expect(screen.getAllByText(/^(Valid until|Expires in|Expired)/)).toHaveLength(1);
    });
  });
  test('A failed page offers a retry', ({ given, when, then, and }) => {
    given('the timeline has more than one page and the second page fails once', async () => {
      const events = Array.from({ length: 25 }, (_, i) =>
        anEvent({ date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10), odometerKm: 1000 + i, details: { kind: 'SCAN', serviceName: `Event ${i}` } }),
      );
      await openTimeline(withEvents(...events));
      expect(await screen.findByText('Event 24')).toBeTruthy();
      await waitFor(() => expect(fake.callsTo('getTimeline')).toHaveLength(1));
      fake.failNext('getTimeline', 500, 'internal-error');
    });
    when('I scroll to the end of the list', async () => {
      await fireEvent(screen.getByTestId('timeline-list'), 'onEndReached');
      await waitFor(() => expect(fake.callsTo('getTimeline')).toHaveLength(2));
    });
    then(/^the list ends with "(.*)" and a retry$/, async (text: string) => {
      expect(text).toBe(en.timeline.loadMoreFailed);
      const footer = await screen.findByTestId('timeline-load-more-failed');
      expect(within(footer).getByText(text)).toBeTruthy();
      expect(within(footer).getByRole('button', { name: en.common.retry })).toBeTruthy();
      // The failed request was the second page.
      expect(fake.callsTo('getTimeline')[1].path).toContain('cursor=');
      // Scrolling to the end again (or the list re-firing as the footer changes size) must not retry by itself.
      await fireEvent(screen.getByTestId('timeline-list'), 'onEndReached');
      await fireEvent(screen.getByTestId('timeline-list'), 'onEndReached');
      expect(fake.callsTo('getTimeline')).toHaveLength(2);
    });
    and('retrying loads the next page', async () => {
      await fireEvent.press(within(screen.getByTestId('timeline-load-more-failed')).getByRole('button', { name: en.common.retry }));
      await waitFor(() => expect(fake.callsTo('getTimeline')).toHaveLength(3));
      expect(fake.callsTo('getTimeline')[2].path).toContain('cursor=');
      await waitFor(() => expect(screen.queryByTestId('timeline-load-more-failed')).toBeNull());
      // The list is virtualised, so the rows of page two may not be drawn. That page was the last: reaching the end again asks for nothing.
      await fireEvent(screen.getByTestId('timeline-list'), 'onEndReached');
      expect(fake.callsTo('getTimeline')).toHaveLength(3);
    });
  });
});
