import { anEvent } from '../../../../test/fake-api';
import { eventMeta, eventTitle, groupByYear } from './display';

test('the title is the service name, else the label of the type', () => {
  expect(eventTitle(anEvent({ details: { serviceName: 'Oil change' } }))).toBe('Oil change');
  expect(eventTitle(anEvent({ type: 'TIRES', details: null }))).toBe('Tires');
  expect(eventTitle(anEvent({ type: 'ITP', details: { serviceName: null } }))).toBe('ITP');
});

test('the meta line is kilometres, then cost', () => {
  expect(eventMeta(anEvent({ odometerKm: 84200, costAmount: 350, currency: 'RON' }))).toBe('84,200 km · 350 RON');
  expect(eventMeta(anEvent({ odometerKm: 900, costAmount: 149.5, currency: 'EUR' }))).toBe('900 km · 149.5 EUR');
});

test('groupByYear keeps the newest-first order of events and of years', () => {
  const a = anEvent({ date: '2025-02-01' });
  const b = anEvent({ date: '2024-12-31' });
  const c = anEvent({ date: '2024-01-01' });
  expect(groupByYear([a, b, c])).toEqual([
    { year: 2025, events: [a] },
    { year: 2024, events: [b, c] },
  ]);
  expect(groupByYear([])).toEqual([]);
});
