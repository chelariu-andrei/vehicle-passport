import { vehicleFormSchema } from './vehicleForm';

const now = new Date('2026-11-09T12:00:00Z');
const schema = vehicleFormSchema(now);
const ok = { vin: 'WVWZZZ1JZXW000001', make: 'Volkswagen', model: 'Golf', engine: '', year: 2015, fuel: 'DIESEL' };
const parse = (o: Record<string, unknown>) => schema.parse({ ...ok, ...o });
const accepts = (o: Record<string, unknown>) => expect(schema.safeParse({ ...ok, ...o }).success).toBe(true);
const rejects = (o: Record<string, unknown>) => expect(schema.safeParse({ ...ok, ...o }).success).toBe(false);

test('uppercases the VIN', () => {
  expect(parse({ vin: 'wvwzzz1jzxw000001' }).vin).toBe('WVWZZZ1JZXW000001');
});

test('rejects a VIN with I, O or Q, or of the wrong length', () => {
  rejects({ vin: 'WVWZZZ1JZXW00000I' });
  rejects({ vin: 'WVWZZZ1JZXW00000' });
  rejects({ vin: 'WVWZZZ1JZXW0000011' });
});

test('year runs from 1886 to next year', () => {
  rejects({ year: 1885 });
  accepts({ year: 1886 });
  accepts({ year: now.getFullYear() + 1 });
  rejects({ year: now.getFullYear() + 2 });
  rejects({ year: '' });
});

test('year typed as text is read as a number', () => {
  expect(parse({ year: '2015' }).year).toBe(2015);
});

test('an empty engine is left out; make and model are trimmed and required', () => {
  expect('engine' in parse({ engine: '  ' })).toBe(false);
  expect(parse({ engine: ' 1.6 TDI ' }).engine).toBe('1.6 TDI');
  expect(parse({ make: ' Audi ' }).make).toBe('Audi');
  rejects({ make: ' ' });
  rejects({ model: '' });
  rejects({ make: 'x'.repeat(101) });
});

test('fuel must be one the contract lists', () => {
  rejects({ fuel: 'STEAM' });
  accepts({ fuel: 'ELECTRIC' });
});
