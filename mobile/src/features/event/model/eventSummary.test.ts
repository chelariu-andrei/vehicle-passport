import type { EventForm } from './eventForm';
import { eventSummary } from './eventSummary';

const form: EventForm = { type: 'SERVICE', date: '2026-03-09', odometerKm: 148200, costAmount: 350.5, currency: 'RON', notes: '' };

test('the rows are type, date, odometer and cost, the odometer standing out', () => {
  expect(eventSummary(form, 0)).toEqual([
    { label: 'Type', value: 'Service' },
    { label: 'Date', value: '2026-03-09' },
    { label: 'Odometer', value: '148 200 km', emphasis: true },
    { label: 'Cost', value: '350.5 RON' },
  ]);
});

test('notes and documents join the rows only when there are some', () => {
  const rows = eventSummary({ ...form, notes: 'Oil change' }, 2);
  expect(rows.slice(4)).toEqual([
    { label: 'Notes', value: 'Oil change' },
    { label: 'Documents', value: '2 files' },
  ]);
});
