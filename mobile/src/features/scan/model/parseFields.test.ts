import { parseFields } from './parseFields';

describe('parseFields', () => {
  it.each([null, undefined, {}, { date: null }, { date: { value: null, confidence: 0.9 } }])(
    'reads %j as an empty date',
    (fields) => {
      expect(parseFields(fields as never).date.value).toBeNull();
    },
  );

  it('reads malformed values as empty instead of failing', () => {
    expect(parseFields({ odometerKm: { value: 'abc', confidence: 0.9 } }).odometerKm.value).toBeNull();
    expect(parseFields({ date: { value: 'not-a-date', confidence: 0.9 } }).date.value).toBeNull();
    expect(parseFields({ date: { value: '2024-02-31', confidence: 0.9 } }).date.value).toBeNull();
    expect(parseFields({ total: { value: '12', confidence: 0.9 } }).total.value).toBeNull();
    expect(parseFields({ parts: { value: 'x', confidence: 0.9 } }).parts).toEqual([]);
    expect(parseFields({ parts: { value: [null, 3, { name: 7 }], confidence: 0.9 } }).parts).toEqual([
      { name: '', qty: null, price: null },
    ]);
  });

  it('keeps a part with no quantity and a missing quantity as null', () => {
    const { parts } = parseFields({ parts: { value: [{ name: 'Oil', qty: null, price: 120 }], confidence: 0.9 } });
    expect(parts).toEqual([{ name: 'Oil', qty: null, price: 120 }]);
  });

  it('reads good values', () => {
    const d = parseFields({
      serviceName: { value: 'Auto Service SRL', confidence: 0.95 },
      date: { value: '2024-03-10', confidence: 0.95 },
      odometerKm: { value: 84200, confidence: 0.95 },
      total: { value: 350.5, confidence: 0.95 },
      labor: { value: 100, confidence: 0.95 },
    });
    expect(d.serviceName.value).toBe('Auto Service SRL');
    expect(d.date.value).toBe('2024-03-10');
    expect(d.odometerKm.value).toBe(84200);
    expect(d.total.value).toBe(350.5);
    expect(d.labor.value).toBe(100);
  });

  it('flags confidence below 0.8 only', () => {
    expect(parseFields({ total: { value: 10, confidence: 0.79 } }).total.flagged).toBe(true);
    expect(parseFields({ total: { value: 10, confidence: 0.8 } }).total.flagged).toBe(false);
    expect(parseFields({ parts: { value: [], confidence: 0.1 } }).partsFlagged).toBe(true);
  });

  it('flags a value it could not read, and not a field that is simply absent', () => {
    expect(parseFields({ odometerKm: { value: 'abc', confidence: 0.99 } }).odometerKm.flagged).toBe(true);
    expect(parseFields({}).odometerKm.flagged).toBe(false);
    expect(parseFields({ total: { value: 10 } as never }).total.flagged).toBe(true);
  });

  it('defaults the type and currency', () => {
    expect(parseFields(null)).toMatchObject({ type: 'SERVICE', currency: 'RON', notes: null });
  });
});
