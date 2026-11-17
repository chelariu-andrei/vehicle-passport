import { aFuelEntry } from '../../../../test/fake-api';
import { fuelTypeChoice, initialForm } from './fuelDefaults';

describe('fuelTypeChoice', () => {
  test.each([
    ['PETROL', ['PETROL'], 'PETROL'],
    ['DIESEL', ['DIESEL'], 'DIESEL'],
    ['LPG', ['LPG'], 'LPG'],
    ['ELECTRIC', ['ELECTRIC'], 'ELECTRIC'],
  ] as const)('%s car has one fixed choice', (fuel, options, def) => {
    expect(fuelTypeChoice(fuel)).toEqual({ options, default: def });
  });

  test('hybrid chooses between petrol and electric, petrol first', () => {
    expect(fuelTypeChoice('HYBRID')).toEqual({ options: ['PETROL', 'ELECTRIC'], default: 'PETROL' });
  });

  test('other offers every fuel and no default', () => {
    expect(fuelTypeChoice('OTHER')).toEqual({ options: ['PETROL', 'DIESEL', 'LPG', 'ELECTRIC'], default: null });
  });
});

describe('initialForm', () => {
  test('a first fill-up starts empty with today, full tank and RON', () => {
    const f = initialForm({ vehicleFuel: 'DIESEL', lastEntry: null, lastKm: null, today: '2026-11-17' });
    expect(f).toMatchObject({
      date: '2026-11-17',
      odometerKm: '',
      fuelType: 'DIESEL',
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
    });
  });

  test('km, currency and station carry over from the last entry', () => {
    const last = aFuelEntry({ currency: 'EUR', station: 'OMV' });
    const f = initialForm({ vehicleFuel: 'PETROL', lastEntry: last, lastKm: 84210, today: '2026-11-17' });
    expect(f.odometerKm).toBe('84210');
    expect(f.currency).toBe('EUR');
    expect(f.station).toBe('OMV');
  });

  test('a hybrid starts on petrol, an unknown fuel starts with no choice', () => {
    expect(initialForm({ vehicleFuel: 'HYBRID', lastEntry: null, lastKm: null, today: '2026-11-17' }).fuelType).toBe('PETROL');
    expect(initialForm({ vehicleFuel: 'OTHER', lastEntry: null, lastKm: null, today: '2026-11-17' }).fuelType).toBeNull();
  });

  test('a hybrid that last charged starts on electric', () => {
    const last = aFuelEntry({ fuelType: 'ELECTRIC', unit: 'KWH' });
    expect(initialForm({ vehicleFuel: 'HYBRID', lastEntry: last, lastKm: 1000, today: '2026-11-17' }).fuelType).toBe('ELECTRIC');
  });
});
