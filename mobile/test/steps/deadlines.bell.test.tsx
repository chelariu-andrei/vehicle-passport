import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { formatLocalDate } from '@/features/event';
import { tokens } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { FakeApi } from '../fake-api';
import { aVehicle, anEvent, SAMPLE_VIN } from '../fake-api';
import { openApp } from '../harness';

const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
};
const policy = (validUntil: string) =>
  anEvent({
    type: 'INSURANCE',
    date: '2025-01-01',
    validFrom: '2025-01-01',
    validUntil,
    details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz', policyNumber: null } as never,
  });
const itp = (validUntil: string) => anEvent({ type: 'ITP', date: '2025-01-01', validFrom: '2025-01-01', validUntil });

const seedWith = (...events: ReturnType<typeof anEvent>[]) => (api: FakeApi) => {
  api.state.vehicles.push(aVehicle());
  api.state.events[SAMPLE_VIN] = events;
};

const bell = () => screen.findByRole('button', { name: en.deadlines.bellLabel });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('the bell on the car screen', () => {
  it('has no badge when nothing needs attention', async () => {
    await openApp('/', { seed: seedWith(policy(plusDays(200))) });
    const b = await bell();
    await waitFor(() => expect(b.props.accessibilityValue).toEqual({ text: en.deadlines.bellValue(0) }));
    expect(screen.queryByTestId('deadlines-badge')).toBeNull();
  });

  it('counts expiring documents in the warning colour', async () => {
    await openApp('/', { seed: seedWith(policy(plusDays(12)), itp(plusDays(5))) });
    const b = await bell();
    await waitFor(() => expect(b.props.accessibilityValue).toEqual({ text: en.deadlines.bellValue(2) }));
    const badge = await screen.findByTestId('deadlines-badge');
    expect(await screen.findByText('2')).toBeTruthy();
    expect([tokens.color.dark.warning, tokens.color.light.warning]).toContain(StyleSheet.flatten(badge.props.style).backgroundColor);
  });

  it('turns the badge to the danger colour when any document is expired', async () => {
    await openApp('/', { seed: seedWith(policy(plusDays(12)), itp(plusDays(-2))) });
    const badge = await screen.findByTestId('deadlines-badge');
    expect([tokens.color.dark.danger, tokens.color.light.danger]).toContain(StyleSheet.flatten(badge.props.style).backgroundColor);
  });

  it('shows no badge, and no guessed count, when the status cannot be loaded', async () => {
    const fake = await openApp('/', {
      seed: (api) => {
        seedWith(policy(plusDays(12)))(api);
        api.failNext('getDeadlines', 500, null);
      },
    });
    const b = await bell();
    await waitFor(() => expect(fake.callsTo('getDeadlines').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('deadlines-badge')).toBeNull();
    expect(b.props.accessibilityValue?.text).toBeUndefined();
  });

  it('opens Document status', async () => {
    await openApp('/', { seed: seedWith() });
    await fireEvent.press(await bell());
    await waitFor(() => expect(screen).toHavePathname(`/vehicles/${SAMPLE_VIN}/deadlines`));
  });
});
