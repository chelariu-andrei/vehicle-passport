import { activeCount, EMPTY_FILTERS, periodPreset, pickYear, setPeriod, toQuery } from './timelineFilters';

describe('timeline filters', () => {
  it('pickYear sets bounds', () => {
    const picked = pickYear({ ...EMPTY_FILTERS, from: '2024-03-01', to: null }, 2025);
    expect(picked).toEqual({ ...EMPTY_FILTERS, year: 2025, from: '2025-01-01', to: '2025-12-31' });
    // "All years" takes the bounds away.
    expect(pickYear(picked, null)).toEqual(EMPTY_FILTERS);
  });

  it('setPeriod clears year', () => {
    const withYear = pickYear({ ...EMPTY_FILTERS, types: ['ITP'] }, 2025);
    expect(setPeriod(withYear, '2025-02-01', '2025-06-30')).toEqual({ ...EMPTY_FILTERS, types: ['ITP'], year: null, from: '2025-02-01', to: '2025-06-30' });
    expect(setPeriod(withYear, null, null)).toEqual({ ...EMPTY_FILTERS, types: ['ITP'] });
  });

  it('toQuery omits empty', () => {
    expect(toQuery(EMPTY_FILTERS)).toEqual({});
    expect(toQuery({ types: ['INSURANCE'], components: ['BRAKES', 'ENGINE'], year: 2025, from: '2025-01-01', to: '2025-12-31' })).toEqual({
      type: ['INSURANCE'],
      component: ['BRAKES', 'ENGINE'],
      from: '2025-01-01',
      to: '2025-12-31',
    });
    expect(toQuery({ ...EMPTY_FILTERS, to: '2025-12-31' })).toEqual({ to: '2025-12-31' });
  });

  it('activeCount', () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(activeCount({ ...EMPTY_FILTERS, types: ['ITP', 'REPAIR'], components: ['BRAKES'] })).toBe(3);
    // A year or a period is one filter, however it is bounded.
    expect(activeCount(pickYear(EMPTY_FILTERS, 2025))).toBe(1);
    expect(activeCount(setPeriod(EMPTY_FILTERS, '2025-01-01', null))).toBe(1);
  });

  it('periodPreset', () => {
    expect(periodPreset('LAST_12_MONTHS', '2026-11-17')).toEqual({ from: '2025-11-18', to: '2026-11-17' });
    expect(periodPreset('LAST_12_MONTHS', '2024-02-29')).toEqual({ from: '2023-03-01', to: '2024-02-29' });
    expect(periodPreset('THIS_YEAR', '2026-11-17')).toEqual({ from: '2026-01-01', to: '2026-11-17' });
    expect(periodPreset('LAST_YEAR', '2026-11-17')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});
