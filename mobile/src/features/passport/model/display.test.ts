import { aPassport, aVehicle } from '../../../../test/fake-api';
import { expiryFrom, passportHeader, truncateHash } from './display';

const V = 'WVWZZZ1KZAW000001';

test('an expiry choice is that many days after now, as an ISO instant', () => {
  expect(expiryFrom(7, new Date('2026-11-09T10:00:00Z'))).toBe('2026-11-16T10:00:00.000Z');
  expect(expiryFrom(30, new Date('2026-11-09T10:00:00Z'))).toBe('2026-12-09T10:00:00.000Z');
  expect(expiryFrom(90, new Date('2026-11-09T10:00:00Z'))).toBe('2027-02-07T10:00:00.000Z');
});

test('no expiry yields no date', () => {
  expect(expiryFrom(null, new Date())).toBeNull();
});

test('the header is make and model when the car is in the garage, else the VIN', () => {
  expect(passportHeader(aPassport({ vin: V }), [aVehicle({ vin: V, make: 'Dacia', model: 'Logan' })])).toBe('Dacia Logan');
  expect(passportHeader(aPassport({ vin: V }), [])).toBe(V);
  expect(passportHeader(aPassport({ vin: V }), [aVehicle({ vin: 'WVWZZZ1KZAW000002', make: 'Dacia', model: 'Logan' })])).toBe(V);
});

test('a hash is shortened to its first and last four characters, upper case', () => {
  expect(truncateHash('9f2c0000000000000000000000000000a41b')).toBe('9F2C…A41B');
});

test('a hash too short to shorten is shown whole', () => {
  expect(truncateHash('9f2c')).toBe('9F2C');
});
