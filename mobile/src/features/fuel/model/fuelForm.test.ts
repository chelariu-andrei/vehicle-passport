import { editAmount, parseDecimal, toFuelEntryRequest, validateFuelForm, type FuelFormState } from './fuelForm';

const base: FuelFormState = {
  date: '2026-11-17',
  odometerKm: '84210',
  fuelType: 'PETROL',
  quantity: '',
  unitPrice: '',
  total: '',
  touched: [],
  fullTank: true,
  missedPrevious: false,
  grade: null,
  chargeType: null,
  station: '',
  note: '',
  currency: 'RON',
};

const ctx = { lastKm: 84000, isElectric: false };

describe('parseDecimal', () => {
  test.each([
    ['38.2', 38.2],
    ['38,2', 38.2],
    [' 38,2 ', 38.2],
    ['0', 0],
    ['312', 312],
  ])('%s parses to %s', (raw, expected) => expect(parseDecimal(raw)).toBe(expected));

  test.each(['', '38,', '.', ',', 'abc', '-5', '1.2.3', '1,2,3'])('%j is not a number', (raw) => {
    expect(parseDecimal(raw)).toBeNull();
  });
});

describe('editAmount (any two of three)', () => {
  test('quantity + total gives the unit price', () => {
    const s = editAmount(editAmount(base, 'quantity', '38.2'), 'total', '312');
    expect(s.unitPrice).toBe('8.168');
  });

  test('quantity + unit price gives the total', () => {
    const s = editAmount(editAmount(base, 'quantity', '38.2'), 'unitPrice', '8.17');
    expect(s.total).toBe('312.09');
  });

  test('unit price + total gives the quantity', () => {
    const s = editAmount(editAmount(base, 'unitPrice', '8.17'), 'total', '312');
    expect(s.quantity).toBe('38.188');
  });

  test('the last two edited win on a third edit', () => {
    let s = editAmount(base, 'quantity', '40');
    s = editAmount(s, 'total', '300');
    expect(s.unitPrice).toBe('7.5');
    s = editAmount(s, 'unitPrice', '8');
    expect(s.touched).toEqual(['total', 'unitPrice']);
    expect(s.quantity).toBe('37.5');
    expect(s.total).toBe('300');
  });

  test('editing the same field again keeps the other touched field', () => {
    let s = editAmount(base, 'quantity', '40');
    s = editAmount(s, 'total', '300');
    s = editAmount(s, 'total', '320');
    expect(s.touched).toEqual(['quantity', 'total']);
    expect(s.unitPrice).toBe('8');
  });

  test('a half-typed number leaves the computed field alone and never produces NaN', () => {
    let s = editAmount(base, 'quantity', '40');
    s = editAmount(s, 'total', '300');
    s = editAmount(s, 'quantity', '4,');
    expect(s.quantity).toBe('4,');
    expect(s.unitPrice).toBe('7.5');
    expect(JSON.stringify(s)).not.toContain('NaN');
  });

  test('a decimal comma is accepted', () => {
    const s = editAmount(editAmount(base, 'quantity', '38,2'), 'total', '312');
    expect(s.unitPrice).toBe('8.168');
  });

  test('a zero divisor leaves the third field empty instead of Infinity', () => {
    const s = editAmount(editAmount(base, 'quantity', '0'), 'total', '312');
    expect(s.unitPrice).toBe('');
  });
});

describe('validateFuelForm', () => {
  const filled = editAmount(editAmount(base, 'quantity', '38.2'), 'total', '312');

  test('a complete form has no errors', () => {
    expect(validateFuelForm(filled, ctx).errors).toEqual({});
  });

  test('required fields are reported', () => {
    const r = validateFuelForm({ ...base, odometerKm: '' }, ctx);
    expect(Object.keys(r.errors).sort()).toEqual(['odometerKm', 'quantity', 'total']);
  });

  test('quantity 0 is invalid', () => {
    expect(validateFuelForm(editAmount(filled, 'quantity', '0'), ctx).errors.quantity).toBeDefined();
  });

  test('a missing fuel type is an error', () => {
    expect(validateFuelForm({ ...filled, fuelType: null }, ctx).errors.fuelType).toBeDefined();
  });

  test('km below the last reading is a hint, not an error', () => {
    const r = validateFuelForm({ ...filled, odometerKm: '83000' }, ctx);
    expect(r.errors.odometerKm).toBeUndefined();
    expect(r.hints.odometer).toBe('below-last');
  });

  test('large quantity asks for confirmation: 201 L yes, 200 L no', () => {
    expect(validateFuelForm(editAmount(filled, 'quantity', '201'), ctx).confirmLargeQuantity).toBe(true);
    expect(validateFuelForm(editAmount(filled, 'quantity', '200'), ctx).confirmLargeQuantity).toBe(false);
  });

  test('the kWh limit is 150', () => {
    const e = { lastKm: null, isElectric: true };
    expect(validateFuelForm(editAmount(filled, 'quantity', '151'), e).confirmLargeQuantity).toBe(true);
    expect(validateFuelForm(editAmount(filled, 'quantity', '150'), e).confirmLargeQuantity).toBe(false);
  });
});

describe('toFuelEntryRequest', () => {
  const filled = editAmount(editAmount(base, 'quantity', '38,2'), 'total', '312');

  test('sends quantity and total only, never the unit price', () => {
    const body = toFuelEntryRequest(filled);
    expect(body).toEqual({
      date: '2026-11-17',
      odometerKm: 84210,
      fuelType: 'PETROL',
      quantity: 38.2,
      total: 312,
      currency: 'RON',
      fullTank: true,
      missedPrevious: false,
    });
    expect(body).not.toHaveProperty('unitPrice');
  });

  test('electric drops the grade and keeps the charge type', () => {
    const body = toFuelEntryRequest({ ...filled, fuelType: 'ELECTRIC', grade: 'PREMIUM', chargeType: 'DC_FAST' });
    expect(body.grade).toBeUndefined();
    expect(body.chargeType).toBe('DC_FAST');
  });

  test('liquid fuel drops the charge type and keeps the grade', () => {
    const body = toFuelEntryRequest({ ...filled, grade: 'PREMIUM', chargeType: 'HOME' });
    expect(body.chargeType).toBeUndefined();
    expect(body.grade).toBe('PREMIUM');
  });

  test('empty station and note are omitted, filled ones trimmed', () => {
    expect(toFuelEntryRequest({ ...filled, station: ' ', note: '' })).not.toHaveProperty('station');
    const body = toFuelEntryRequest({ ...filled, station: ' Petrom ', note: ' iarna ' });
    expect(body.station).toBe('Petrom');
    expect(body.note).toBe('iarna');
  });
});
