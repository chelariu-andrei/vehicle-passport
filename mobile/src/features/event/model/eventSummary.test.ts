import type { EventForm } from './eventForm';
import { eventSummary } from './eventSummary';

const form: EventForm = {
  type: 'SERVICE',
  date: '2026-03-09',
  odometerKm: 148200,
  costAmount: 350.5,
  currency: 'RON',
  notes: '',
  customLabel: null,
  validFrom: null,
  validUntil: null,
  details: null,
  components: [],
  customFields: [],
};

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

test('an insurance lists coverage, insurer, policy and period, and has no odometer row without km', () => {
  const rows = eventSummary(
    {
      ...form,
      type: 'INSURANCE',
      odometerKm: null,
      validFrom: '2026-03-12',
      validUntil: '2027-03-11',
      details: { kind: 'INSURANCE', coverage: 'CASCO', insurer: 'Allianz', policyNumber: 'P-1' },
    },
    0,
  );
  expect(rows.map((r) => r.label)).toEqual(['Type', 'Date', 'Coverage', 'Insurer', 'Policy number', 'Valid from', 'Valid until', 'Cost']);
  expect(rows).toContainEqual({ label: 'Coverage', value: 'CASCO' });
  expect(rows).toContainEqual({ label: 'Insurer', value: 'Allianz' });
});

test('a rovinietă lists its duration and its computed end', () => {
  const rows = eventSummary(
    { ...form, type: 'ROVINIETA', odometerKm: null, validFrom: '2026-01-15', details: { kind: 'ROVINIETA', duration: 'TWELVE_MONTHS' } },
    0,
  );
  expect(rows).toContainEqual({ label: 'Duration', value: '12 months' });
  expect(rows).toContainEqual({ label: 'Valid from', value: '2026-01-15' });
  expect(rows).toContainEqual({ label: 'Valid until', value: '2027-01-14' });
});

test('a safety item, an other label, components and custom fields are listed', () => {
  const rows = eventSummary(
    {
      ...form,
      type: 'SAFETY_EQUIPMENT',
      odometerKm: null,
      validUntil: '2027-01-01',
      details: { kind: 'SAFETY_EQUIPMENT', item: 'FIRE_EXTINGUISHER' },
      components: ['BODY'],
      customFields: [{ label: 'Brand', value: 'Acme' }],
    },
    0,
  );
  expect(rows).toContainEqual({ label: 'Item', value: 'Fire extinguisher' });
  expect(rows).toContainEqual({ label: 'Components', value: 'Body' });
  expect(rows).toContainEqual({ label: 'Brand', value: 'Acme' });
  const other = eventSummary({ ...form, type: 'OTHER', odometerKm: null, customLabel: 'Detailing' }, 0);
  expect(other).toContainEqual({ label: 'Name', value: 'Detailing' });
});
