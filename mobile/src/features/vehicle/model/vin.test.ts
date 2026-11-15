import { cleanVin, isVin, makeFromVin } from './vin';

describe('cleanVin', () => {
  test('upper-cases and drops separators', () => {
    expect(cleanVin(' wba 8e1c50-gk123456 ')).toBe('WBA8E1C50GK123456');
  });
  test('drops I, O and Q', () => {
    expect(cleanVin('WBAOIQ8E1')).toBe('WBA8E1');
  });
  test('cuts to 17 characters', () => {
    expect(cleanVin('WBA8E1C50GK1234567890')).toHaveLength(17);
  });
});

describe('isVin', () => {
  test('needs 17 valid characters', () => {
    expect(isVin('WBA8E1C50GK12345')).toBe(false);
    expect(isVin('WBA8E1C50GK123456')).toBe(true);
    expect(isVin('WBA8E1C50GK12345I')).toBe(false);
  });
});

describe('makeFromVin', () => {
  test('looks the maker up from the first three characters', () => {
    expect(makeFromVin('WBA8E1C50GK123456')).toBe('BMW');
    expect(makeFromVin('UU1')).toBe('Dacia');
    expect(makeFromVin('WVWZZZ1JZXW000001')).toBe('Volkswagen');
  });
  test('null when unknown or too short', () => {
    expect(makeFromVin('ZZZ')).toBeNull();
    expect(makeFromVin('WB')).toBeNull();
  });
});
