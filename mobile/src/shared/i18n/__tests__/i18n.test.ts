import { en } from '../en';
import { resolveLocale, translate } from '../index';
import { ro } from '../ro';

describe('i18n', () => {
  it('resolveLocaleSystemRomanianDevice', () => {
    expect(resolveLocale('system', 'ro-RO')).toBe('ro');
    expect(resolveLocale('system', 'ro')).toBe('ro');
    expect(resolveLocale('system', 'en-US')).toBe('en');
    expect(resolveLocale('system', 'de-DE')).toBe('en');
    expect(resolveLocale('en', 'ro-RO')).toBe('en');
    expect(resolveLocale('ro', 'en-US')).toBe('ro');
  });

  it('missingRoKeyFallsBackToEn', () => {
    expect('cars' in ro).toBe(false);
    expect(translate('ro', 'cars.add')).toBe(en.cars.add);
    expect(translate('ro', 'account.signOut')).toBe(ro.account?.signOut);
    expect(translate('ro', 'account.signOut')).not.toBe(en.account.signOut);
  });
});

describe('Romanian counts', () => {
  it('puts "de" only before 20 and up outside x01–x19', () => {
    const count = ro.timeline!.eventCount!;
    expect([0, 1, 2, 19, 20, 100, 101, 119, 120].map(count)).toEqual([
      '0 evenimente',
      '1 eveniment',
      '2 evenimente',
      '19 evenimente',
      '20 de evenimente',
      '100 de evenimente',
      '101 evenimente',
      '119 evenimente',
      '120 de evenimente',
    ]);
  });
});
