import { anEvent } from '../../../../test/fake-api';
import { eventFormSchema, formatLocalDate, formInputOf, maxEventDate, newFormInput, parseMoney, toEventRequest, typeDefaults } from './eventForm';
import type { EventForm } from './eventForm';

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

const form: EventForm = {
  type: 'REPAIR',
  date: '2025-05-01',
  odometerKm: 90000,
  costAmount: 10.5,
  currency: 'EUR',
  notes: ' new note ',
  customLabel: null,
  validFrom: null,
  validUntil: null,
  details: null,
  components: [],
  customFields: [],
};

const SIX = ['costAmount', 'currency', 'date', 'notes', 'odometerKm', 'type'];
const keysOf = (request: object) => Object.keys(request).filter((k) => k !== 'components' && k !== 'customFields').sort();

test('a new entry sends the six contract fields, and always its components and custom fields', () => {
  const request = toEventRequest(null, form);
  expect(keysOf(request)).toEqual(SIX);
  expect(request).toMatchObject({ type: 'REPAIR', date: '2025-05-01', odometerKm: 90000, costAmount: 10.5, currency: 'EUR', components: [], customFields: [] });
});

test('empty notes are sent as null', () => {
  expect(toEventRequest(null, { ...form, notes: '   ' }).notes).toBeNull();
});

test('toEventRequest drops fields the new type does not use', () => {
  const insurance: EventForm = {
    ...form,
    type: 'SERVICE',
    customLabel: 'stale',
    validFrom: '2026-03-12',
    validUntil: '2027-03-11',
    details: { kind: 'INSURANCE', coverage: 'CASCO', insurer: 'Allianz', policyNumber: null },
  };
  const request = toEventRequest(null, insurance);
  expect(request).not.toHaveProperty('details');
  expect(request).not.toHaveProperty('validFrom');
  expect(request).not.toHaveProperty('validUntil');
  expect(request).not.toHaveProperty('customLabel');
});

test('a type sends its own details and validity', () => {
  const request = toEventRequest(null, {
    ...form,
    type: 'INSURANCE',
    odometerKm: null,
    validFrom: '2026-03-12',
    validUntil: '2027-03-11',
    details: { kind: 'INSURANCE', coverage: 'CASCO', insurer: 'Allianz', policyNumber: null },
  });
  expect(request).toMatchObject({ validFrom: '2026-03-12', validUntil: '2027-03-11', odometerKm: null, details: { kind: 'INSURANCE', insurer: 'Allianz' } });
});

test('details of another kind are not sent', () => {
  const request = toEventRequest(null, { ...form, type: 'INSURANCE', details: { kind: 'ROVINIETA', duration: 'ONE_DAY' } });
  expect(request).not.toHaveProperty('details');
});

test('rovinietă request has no validUntil', () => {
  const request = toEventRequest(null, {
    ...form,
    type: 'ROVINIETA',
    odometerKm: null,
    validFrom: '2026-01-15',
    validUntil: '2027-01-14',
    details: { kind: 'ROVINIETA', duration: 'TWELVE_MONTHS' },
  });
  expect(request).toMatchObject({ validFrom: '2026-01-15', details: { kind: 'ROVINIETA', duration: 'TWELVE_MONTHS' } });
  expect(request).not.toHaveProperty('validUntil');
});

test('OTHER carries its label', () => {
  expect(toEventRequest(null, { ...form, type: 'OTHER', customLabel: 'Detailing' })).toMatchObject({ customLabel: 'Detailing' });
});

test('documented keeps facts, takes annotations', () => {
  const original = anEvent({ evidence: 'DOCUMENTED', source: 'SCAN', notes: 'old', details: { kind: 'SCAN', serviceName: 'Brake pads' } });
  const request = toEventRequest(original, { ...form, components: ['BRAKES'], customFields: [{ label: 'Garage', value: 'Bob' }] });
  expect(request).toEqual({
    type: original.type,
    date: original.date,
    odometerKm: original.odometerKm,
    costAmount: original.costAmount,
    currency: original.currency,
    notes: 'new note',
    components: ['BRAKES'],
    customFields: [{ label: 'Garage', value: 'Bob' }],
  });
});

test('a DOCUMENTED ITP echoes its validity and its sendable details, never SCAN details', () => {
  const itp = anEvent({
    type: 'ITP',
    evidence: 'DOCUMENTED',
    source: 'SCAN',
    validUntil: '2027-03-09',
    details: { kind: 'ITP', station: 'RAR', result: 'PASSED' },
  });
  expect(toEventRequest(itp, form)).toMatchObject({ type: 'ITP', validUntil: '2027-03-09', details: { kind: 'ITP', station: 'RAR', result: 'PASSED' } });
  const scanned = anEvent({ type: 'ITP', evidence: 'DOCUMENTED', source: 'SCAN', validUntil: '2027-03-09', details: { kind: 'SCAN', serviceName: 'ITP' } });
  const request = toEventRequest(scanned, form);
  expect(request).not.toHaveProperty('details');
  expect(request).toMatchObject({ validUntil: '2027-03-09' });
});

describe('eventFormSchema', () => {
  const input = {
    type: 'SERVICE' as const,
    date: '2025-05-01',
    odometerKm: '90000',
    costAmount: '10,5',
    currency: 'ron',
    notes: ' hi ',
    customLabel: '',
    validFrom: '',
    validUntil: '',
    details: { coverage: 'RCA' as const, insurer: '', policyNumber: '', duration: 'ONE_DAY' as const, station: '', result: '' as const, item: '' as const },
    components: [],
    customFields: [],
  };
  const parse = (type: EventForm['type'], over: Record<string, unknown> = {}) =>
    eventFormSchema(type, '2026-06-01').safeParse({ ...input, type, ...over });

  test('a plain service parses to numbers and nulls', () => {
    const r = parse('SERVICE');
    expect(r.success && r.data).toMatchObject({ odometerKm: 90000, costAmount: 10.5, currency: 'RON', notes: 'hi', details: null, validFrom: null, validUntil: null, customLabel: null });
  });

  test('insurance km optional', () => {
    const r = parse('INSURANCE', {
      odometerKm: '',
      validFrom: '2026-03-12',
      validUntil: '2027-03-11',
      details: { ...input.details, insurer: ' Allianz ', policyNumber: '' },
    });
    expect(r.success && r.data).toMatchObject({
      odometerKm: null,
      details: { kind: 'INSURANCE', coverage: 'RCA', insurer: 'Allianz', policyNumber: null },
    });
  });

  test('service km are required', () => {
    expect(parse('SERVICE', { odometerKm: '' }).success).toBe(false);
  });

  test('insurance needs an insurer and a period that does not end before it starts', () => {
    const base = { odometerKm: '', validFrom: '2026-03-12', validUntil: '2027-03-11' };
    expect(parse('INSURANCE', base).success).toBe(false);
    const details = { ...input.details, insurer: 'Allianz' };
    expect(parse('INSURANCE', { ...base, details }).success).toBe(true);
    expect(parse('INSURANCE', { ...base, details, validUntil: '2026-03-01' }).success).toBe(false);
    expect(parse('INSURANCE', { ...base, details, validUntil: '' }).success).toBe(false);
  });

  test('rovinietă needs validFrom, and its parsed form has no validUntil', () => {
    const base = { odometerKm: '', details: { ...input.details, duration: 'TWELVE_MONTHS' as const } };
    expect(parse('ROVINIETA', base).success).toBe(false);
    const r = parse('ROVINIETA', { ...base, validFrom: '2026-01-15', validUntil: '2027-01-14' });
    expect(r.success && r.data).toMatchObject({ validFrom: '2026-01-15', validUntil: null, details: { kind: 'ROVINIETA', duration: 'TWELVE_MONTHS' } });
  });

  test('safety equipment needs an item and a valid until', () => {
    const base = { odometerKm: '', details: { ...input.details, item: 'FIRST_AID_KIT' as const } };
    expect(parse('SAFETY_EQUIPMENT', base).success).toBe(false);
    expect(parse('SAFETY_EQUIPMENT', { ...base, validUntil: '2027-01-01' }).success).toBe(true);
    expect(parse('SAFETY_EQUIPMENT', { odometerKm: '', validUntil: '2027-01-01' }).success).toBe(false);
  });

  test('ITP result and expiry are optional', () => {
    const r = parse('ITP', { details: { ...input.details, station: ' RAR ', result: 'PASSED' } });
    expect(r.success && r.data).toMatchObject({ validUntil: null, details: { kind: 'ITP', station: 'RAR', result: 'PASSED' } });
    const bare = parse('ITP');
    expect(bare.success && bare.data).toMatchObject({ details: null });
  });

  test('OTHER without label is invalid', () => {
    expect(parse('OTHER', { odometerKm: '' }).success).toBe(false);
    expect(parse('OTHER', { odometerKm: '', customLabel: '   ' }).success).toBe(false);
    const r = parse('OTHER', { odometerKm: '', customLabel: ' Detailing ' });
    expect(r.success && r.data.customLabel).toBe('Detailing');
  });

  test('a stale label from another type is dropped', () => {
    const r = parse('SERVICE', { customLabel: 'stale', validUntil: '2027-01-01' });
    expect(r.success && r.data).toMatchObject({ customLabel: null, validUntil: null });
  });

  test('11 custom fields invalid; blank rows are dropped, half rows refused', () => {
    const ok = parse('SERVICE', { customFields: [{ label: ' Garage ', value: 'Bob' }, { label: '', value: '' }] });
    expect(ok.success && ok.data.customFields).toEqual([{ label: 'Garage', value: 'Bob' }]);
    expect(parse('SERVICE', { customFields: [{ label: 'Garage', value: '' }] }).success).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ label: `L${i}`, value: 'v' }));
    expect(parse('SERVICE', { customFields: eleven }).success).toBe(false);
    expect(parse('SERVICE', { customFields: eleven.slice(0, 10) }).success).toBe(true);
    expect(parse('SERVICE', { customFields: [{ label: 'x'.repeat(41), value: 'v' }] }).success).toBe(false);
  });

  test('policy number is at most 60 characters, station at most 100', () => {
    const insurance = (policyNumber: string) =>
      parse('INSURANCE', { odometerKm: '', validFrom: '2026-03-12', validUntil: '2027-03-11', details: { ...input.details, insurer: 'Allianz', policyNumber } });
    expect(insurance('p'.repeat(60)).success).toBe(true);
    expect(insurance('p'.repeat(61)).success).toBe(false);
    const itp = (station: string) => parse('ITP', { details: { ...input.details, station } });
    expect(itp('s'.repeat(100)).success).toBe(true);
    expect(itp('s'.repeat(101)).success).toBe(false);
  });

  test('blank custom field rows do not count towards the limit of ten', () => {
    const real = Array.from({ length: 10 }, (_, i) => ({ label: `L${i}`, value: 'v' }));
    const blank = { label: '', value: '' };
    const ok = parse('SERVICE', { customFields: [...real, blank] });
    expect(ok.success && ok.data.customFields).toHaveLength(10);
    expect(parse('SERVICE', { customFields: [...real, { label: 'L10', value: 'v' }, blank] }).success).toBe(false);
  });

  test('a date after the limit is refused', () => {
    expect(parse('SERVICE', { date: '2026-06-02' }).success).toBe(false);
  });
});

describe('form defaults', () => {
  test('changing type resets the type boxes, suggests components and starts validity at the date', () => {
    expect(typeDefaults('TIRES', '2026-05-01')).toMatchObject({ customLabel: '', validFrom: '', validUntil: '', components: ['TIRES_WHEELS'] });
    expect(typeDefaults('ROVINIETA', '2026-05-01').validFrom).toBe('2026-05-01');
    expect(typeDefaults('INSURANCE', '2026-05-01').validFrom).toBe('2026-05-01');
    expect(typeDefaults('SAFETY_EQUIPMENT', '2026-05-01').validFrom).toBe('');
  });

  test('an existing event opens with its own boxes', () => {
    const input = formInputOf(
      anEvent({
        type: 'INSURANCE',
        odometerKm: null,
        validFrom: '2026-03-12',
        validUntil: '2027-03-11',
        details: { kind: 'INSURANCE', coverage: 'CASCO', insurer: 'Allianz', policyNumber: null },
        components: ['BODY'],
        customFields: [{ label: 'a', value: 'b' }],
      }),
    );
    expect(input).toMatchObject({ odometerKm: '', validFrom: '2026-03-12', details: { coverage: 'CASCO', insurer: 'Allianz', policyNumber: '' }, components: ['BODY'] });
    expect(newFormInput('2026-05-01')).toMatchObject({ type: 'SERVICE', date: '2026-05-01', currency: 'RON', components: [] });
  });
});
