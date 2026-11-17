import { anEvent } from '../../../../test/fake-api';
import { dayAndMonth, groupByYear } from './display';

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

test('dayAndMonth splits an ISO date into day and short month', () => {
  expect(dayAndMonth('2024-03-10')).toEqual({ day: '10', month: 'Mar' });
  expect(dayAndMonth('2026-12-02')).toEqual({ day: '2', month: 'Dec' });
});
