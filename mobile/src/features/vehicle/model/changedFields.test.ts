import type { VehicleResponse } from '../api/useVehicles';
import { changedFields } from './changedFields';
import type { VehicleForm } from './changedFields';

const original: VehicleResponse = {
  vin: 'WVWZZZ1JZXW000001',
  make: 'Volkswagen',
  model: 'Golf',
  engine: '1.6 TDI',
  year: 2015,
  fuel: 'DIESEL',
};
const same: VehicleForm = { vin: original.vin, make: 'Volkswagen', model: 'Golf', engine: '1.6 TDI', year: 2015, fuel: 'DIESEL' };
// A form whose engine was cleared has no `engine` key: the form schema drops an empty one.
const withoutEngine = ({ engine: _engine, ...rest }: VehicleForm): VehicleForm => rest;

describe('changedFields', () => {
  it('is empty when nothing changed', () => {
    expect(changedFields(original, same)).toEqual({});
  });

  it('carries only the year when only the year changed', () => {
    expect(changedFields(original, { ...same, year: 2016 })).toEqual({ year: 2016 });
  });

  it('never carries the VIN', () => {
    expect(changedFields(original, { ...same, vin: 'WVWZZZ1JZXW000002' })).toEqual({});
  });

  it('sends an empty string when the engine is cleared, because the contract has no null', () => {
    expect(changedFields(original, withoutEngine(same))).toEqual({ engine: '' });
  });

  it('treats a car stored without an engine and a blank engine field as the same', () => {
    expect(changedFields({ ...original, engine: null }, withoutEngine(same))).toEqual({});
    expect(changedFields({ ...original, engine: undefined }, withoutEngine(same))).toEqual({});
  });

  it('sets an engine on a car that had none', () => {
    expect(changedFields({ ...original, engine: null }, same)).toEqual({ engine: '1.6 TDI' });
  });

  it('reports every field that changed', () => {
    expect(changedFields(original, { ...same, make: 'Audi', model: 'A3', fuel: 'PETROL' })).toEqual({
      make: 'Audi',
      model: 'A3',
      fuel: 'PETROL',
    });
  });
});
