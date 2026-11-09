import { anEvent } from '../../../../test/fake-api';
import { formatLocalDate, maxEventDate, parseMoney, toEventRequest } from './eventForm';

test('parseMoney reads a decimal point or a decimal comma', () => {
  expect(parseMoney('149,50')).toBe(149.5);
  expect(parseMoney('149.50')).toBe(149.5);
  expect(parseMoney('0')).toBe(0);
  expect(parseMoney(' 12 ')).toBe(12);
});

test.each(['', 'abc', '-1', '1.999', '1.234,50'])('parseMoney refuses %p', (bad) => {
  expect(parseMoney(bad)).toBeNull();
});

test('the latest selectable date never runs ahead of the server, which counts in UTC', () => {
  // Bucharest, 01:30 on the 16th: the server still says the 15th.
  expect(maxEventDate(new Date('2026-06-15T22:30:00Z'), -180)).toBe('2026-06-15');
  // New York, 21:00 on the 15th: the phone is behind the server.
  expect(maxEventDate(new Date('2026-06-16T02:00:00Z'), 300)).toBe('2026-06-15');
  expect(maxEventDate(new Date('2026-06-15T12:00:00Z'), 0)).toBe('2026-06-15');
});

test('formatLocalDate uses the local calendar, zero padded', () => {
  expect(formatLocalDate(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
});

const form = {
  type: 'REPAIR' as const,
  date: '2025-05-01',
  odometerKm: 90000,
  costAmount: 10.5,
  currency: 'EUR',
  notes: ' new note ',
};

test('a new entry sends the six contract fields', () => {
  const request = toEventRequest(null, form);
  expect(Object.keys(request).sort()).toEqual(['costAmount', 'currency', 'date', 'notes', 'odometerKm', 'type']);
  expect(request).toMatchObject({ type: 'REPAIR', date: '2025-05-01', odometerKm: 90000, costAmount: 10.5, currency: 'EUR' });
});

test('empty notes are sent as null', () => {
  expect(toEventRequest(null, { ...form, notes: '   ' }).notes).toBeNull();
});

test('a DOCUMENTED original keeps every field but notes, whatever the form says', () => {
  const original = anEvent({ evidence: 'DOCUMENTED', source: 'SCAN', notes: 'old' });
  const request = toEventRequest(original, form);
  expect(Object.keys(request).sort()).toEqual(['costAmount', 'currency', 'date', 'notes', 'odometerKm', 'type']);
  expect(request).toEqual({
    type: original.type,
    date: original.date,
    odometerKm: original.odometerKm,
    costAmount: original.costAmount,
    currency: original.currency,
    notes: 'new note',
  });
});
