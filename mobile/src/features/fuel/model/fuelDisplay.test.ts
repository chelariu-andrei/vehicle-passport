import { consumptionUnit, formatConsumption, formatKm, formatMoney, formatQuantity, unitOf } from './fuelDisplay';

test('units follow the fuel type', () => {
  expect(unitOf('DIESEL')).toBe('L');
  expect(unitOf('LPG')).toBe('L');
  expect(unitOf('ELECTRIC')).toBe('kWh');
  expect(consumptionUnit('PETROL')).toBe('L/100 km');
  expect(consumptionUnit('ELECTRIC')).toBe('kWh/100 km');
});

test('formatQuantity trims trailing zeros and carries the unit', () => {
  expect(formatQuantity(38.2, 'L', 'en')).toBe('38.2 L');
  expect(formatQuantity(40, 'L', 'en')).toBe('40 L');
  expect(formatQuantity(38.2, 'L', 'ro')).toBe('38,2 L');
  expect(formatQuantity(12.5, 'kWh', 'en')).toBe('12.5 kWh');
});

test('formatConsumption shows one decimal, and a dash when unknown', () => {
  expect(formatConsumption(6.94, 'DIESEL', 'en')).toBe('6.9 L/100 km');
  expect(formatConsumption(6.94, 'DIESEL', 'ro')).toBe('6,9 L/100 km');
  expect(formatConsumption(15.3, 'ELECTRIC', 'en')).toBe('15.3 kWh/100 km');
  expect(formatConsumption(null, 'DIESEL', 'en')).toBe('–');
});

test('formatMoney uses the currency and the locale', () => {
  expect(formatMoney(312, 'RON', 'en')).toMatch(/312\.00/);
  expect(formatMoney(312, 'RON', 'en')).toMatch(/RON/);
  expect(formatMoney(312, 'RON', 'ro')).toMatch(/312,00/);
});

test('formatKm groups thousands with a space', () => {
  expect(formatKm(84210)).toBe('84 210');
  expect(formatKm(950)).toBe('950');
  expect(formatKm(1234567)).toBe('1 234 567');
});
