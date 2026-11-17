import { routeForNotification } from './routeForNotification';

describe('routeForNotification', () => {
  it('routes a valid payload to the car’s document status', () => {
    expect(routeForNotification({ vin: 'WVWZZZ1JZXW000001', kind: 'RCA' })).toBe('/vehicles/WVWZZZ1JZXW000001/deadlines');
  });

  it.each([
    ['no payload', undefined],
    ['null', null],
    ['a string', 'WVWZZZ1JZXW000001'],
    ['a payload without vin', { kind: 'RCA' }],
    ['a non-string vin', { vin: 42, kind: 'RCA' }],
    ['an empty vin', { vin: '', kind: 'RCA' }],
  ])('ignores %s', (_, data) => {
    expect(routeForNotification(data)).toBeNull();
  });

  it('keeps a vin from reaching another route', () => {
    expect(routeForNotification({ vin: '../account' })).toBe('/vehicles/..%2Faccount/deadlines');
  });
});
