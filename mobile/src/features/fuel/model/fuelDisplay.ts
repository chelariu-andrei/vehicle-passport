import type { FuelEntryType } from './fuelForm';

export type QuantityUnit = 'L' | 'kWh';

export const unitOf = (type: FuelEntryType): QuantityUnit => (type === 'ELECTRIC' ? 'kWh' : 'L');

export const consumptionUnit = (type: FuelEntryType): `${QuantityUnit}/100 km` => `${unitOf(type)}/100 km`;

const tag = (locale: string) => (locale === 'ro' ? 'ro-RO' : 'en-GB');

export function formatQuantity(quantity: number, unit: QuantityUnit, locale: string): string {
  const n = new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 2 }).format(quantity);
  return `${n} ${unit}`;
}

/** One decimal and the unit, or a dash when there is no value yet. */
export function formatConsumption(value: number | null, type: FuelEntryType, locale: string): string {
  if (value === null) return '–';
  const n = new Intl.NumberFormat(tag(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  return `${n} ${consumptionUnit(type)}`;
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(tag(locale), { style: 'currency', currency, currencyDisplay: 'code' }).format(amount);
}
