import { anEvent } from '../../../../test/fake-api';
import type { EventResponse } from './timeline';
import { rovinietaEnd, validityMarker } from './validity';

describe('rovinietaEnd', () => {
  test.each([
    ['2026-03-10', 'ONE_DAY', '2026-03-10'],
    ['2026-03-10', 'SEVEN_DAYS', '2026-03-16'],
    ['2026-03-10', 'THIRTY_DAYS', '2026-04-08'],
    ['2026-03-10', 'NINETY_DAYS', '2026-06-07'],
    ['2026-03-10', 'TWELVE_MONTHS', '2027-03-09'],
    ['2024-02-29', 'TWELVE_MONTHS', '2025-02-27'],
    ['2026-01-31', 'TWELVE_MONTHS', '2027-01-30'],
    ['2026-12-31', 'ONE_DAY', '2026-12-31'],
    ['2023-12-31', 'SEVEN_DAYS', '2024-01-06'],
    ['2024-02-25', 'SEVEN_DAYS', '2024-03-02'],
  ] as const)('%s + %s ends %s', (from, duration, expected) => {
    expect(rovinietaEnd(from, duration)).toBe(expected);
  });
});

describe('validityMarker', () => {
  const today = '2026-03-10';
  const at = (validityStatus: EventResponse['validityStatus'], validUntil = '2027-03-12') =>
    ({ ...anEvent({ type: 'INSURANCE', validUntil }), validityStatus }) as EventResponse;

  test('VALID', () => {
    expect(validityMarker(at('VALID'), today)).toEqual({ tone: 'ok', text: 'Valid until 12 Mar 2027' });
  });
  test('EXPIRING counts the days to validUntil', () => {
    expect(validityMarker(at('EXPIRING', '2026-03-22'), today)).toEqual({ tone: 'warn', text: 'Expires in 12 days' });
    expect(validityMarker(at('EXPIRING', '2026-03-11'), today)).toEqual({ tone: 'warn', text: 'Expires in 1 day' });
  });
  test('EXPIRED', () => {
    expect(validityMarker(at('EXPIRED', '2026-03-01'), today)).toEqual({ tone: 'danger', text: 'Expired' });
  });
  test('no marker for SUPERSEDED, UNKNOWN or no status', () => {
    expect(validityMarker(at('SUPERSEDED'), today)).toBeNull();
    expect(validityMarker(at('UNKNOWN'), today)).toBeNull();
    expect(validityMarker(at(null), today)).toBeNull();
    expect(validityMarker(at(undefined), today)).toBeNull();
  });
});
