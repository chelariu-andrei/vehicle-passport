import { reviewFormSchema, toConfirmRequest, toForm } from './confirmRequest';
import { parseFields } from './parseFields';
import type { ReviewDraft } from './parseFields';
import { warningText } from './warnings';

const good = (): ReviewDraft =>
  parseFields({
    serviceName: { value: 'Auto Service', confidence: 0.9 },
    date: { value: '2024-03-10', confidence: 0.9 },
    odometerKm: { value: 84200, confidence: 0.9 },
    total: { value: 350, confidence: 0.9 },
    parts: { value: [{ name: 'Oil', qty: 1, price: 120 }], confidence: 0.9 },
  });

describe('toConfirmRequest', () => {
  it('builds the request, with the default type and currency', () => {
    expect(toConfirmRequest(good())).toEqual({
      type: 'SERVICE',
      serviceName: 'Auto Service',
      date: '2024-03-10',
      odometerKm: 84200,
      parts: [{ name: 'Oil', qty: 1, price: 120 }],
      labor: null,
      total: 350,
      currency: 'RON',
      notes: null,
    });
  });

  it('names a missing required value', () => {
    const draftWithoutTotal = { ...good(), total: { value: null, flagged: false } };
    expect(toConfirmRequest(draftWithoutTotal)).toEqual({ missing: ['total'] });
    const noDateOrKm = { ...good(), date: { value: null, flagged: false }, odometerKm: { value: null, flagged: false } };
    expect(toConfirmRequest(noDateOrKm)).toEqual({ missing: ['date', 'odometerKm'] });
  });

  it('names an incomplete part by its position and field', () => {
    const draftWithNullQty = { ...good(), parts: [{ name: 'Oil', qty: null, price: 120 }] };
    expect(toConfirmRequest(draftWithNullQty)).toEqual({ missing: ['parts.0.qty'] });
    const two = { ...good(), parts: [{ name: '', qty: 1, price: 5 }, { name: 'x', qty: 1, price: null }] };
    expect(toConfirmRequest(two)).toEqual({ missing: ['parts.0.name', 'parts.1.price'] });
  });

  it('drops a part row left entirely blank', () => {
    const request = toConfirmRequest({ ...good(), parts: [{ name: '', qty: null, price: null }] });
    expect(request).toMatchObject({ parts: [] });
  });

  it('needs a three-letter currency', () => {
    expect(toConfirmRequest({ ...good(), currency: 'RO' })).toEqual({ missing: ['currency'] });
  });
});

describe('reviewFormSchema', () => {
  const parse = (over: Partial<ReturnType<typeof toForm>>) => reviewFormSchema.safeParse({ ...toForm(good()), ...over });

  it('reads a decimal comma', () => {
    const r = parse({ total: '149,50', labor: '20' });
    expect(r.success && r.data.total.value).toBe(149.5);
    expect(r.success && r.data.labor.value).toBe(20);
  });

  it('turns an empty box into a missing value and trims text', () => {
    const r = parse({ odometerKm: ' ', serviceName: '  ', notes: ' hi ' });
    expect(r.success && r.data.odometerKm.value).toBeNull();
    expect(r.success && r.data.serviceName.value).toBeNull();
    expect(r.success && r.data.notes).toBe('hi');
  });

  it('rejects text that is not a number or a date', () => {
    for (const bad of [{ total: '1.234,50' }, { odometerKm: '12 km' }, { date: '10.03.2024' }, { labor: 'x' }]) {
      expect(parse(bad).success).toBe(false);
    }
  });

  it('rejects a bad part amount at its own path', () => {
    const r = parse({ parts: [{ name: 'Oil', qty: '1', price: 'abc' }] });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].path).toEqual(['parts', 0, 'price']);
  });
});

describe('warningText', () => {
  it('uses the catalog for known codes', () => {
    expect(warningText({ code: 'TOTAL_MISMATCH', message: 'server words' })).not.toBe('server words');
    expect(warningText({ code: 'ODOMETER_INCONSISTENT', message: 'x' })).not.toBe('x');
    expect(warningText({ code: 'DATE_IN_FUTURE', message: 'x' })).not.toBe('x');
  });

  it('shows the server message for an unknown code', () => {
    expect(warningText({ code: 'SOMETHING_NEW', message: 'From the server' })).toBe('From the server');
  });
});
