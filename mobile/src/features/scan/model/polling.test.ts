import { ApiError } from '@/shared/api';

import { nextPollDelay, pollInterval } from './polling';

test('polling starts at 2 s, backs off and settles at 10 s', () => {
  expect([0, 1, 2, 3, 4].map(nextPollDelay)).toEqual([2000, 4000, 8000, 10000, 10000]);
});

const state = (o: Partial<Parameters<typeof pollInterval>[0]> = {}) => ({
  data: undefined,
  error: null,
  dataUpdateCount: 0,
  errorUpdateCount: 0,
  ...o,
});

describe('pollInterval', () => {
  test('a job still being read is asked again, backing off per answer', () => {
    expect(pollInterval(state({ data: { status: 'PENDING' }, dataUpdateCount: 1 }))).toBe(2000);
    expect(pollInterval(state({ data: { status: 'PROCESSING' }, dataUpdateCount: 2 }))).toBe(4000);
  });

  test.each(['EXTRACTED', 'CONFIRMED', 'REJECTED', 'FAILED', 'CANCELLED'] as const)('%s stops polling', (status) => {
    expect(pollInterval(state({ data: { status }, dataUpdateCount: 3 }))).toBe(false);
  });

  test('a first poll that failed is tried again, backing off per failure', () => {
    const error = new ApiError(503);
    expect(pollInterval(state({ error, errorUpdateCount: 1 }))).toBe(2000);
    expect(pollInterval(state({ error, errorUpdateCount: 2 }))).toBe(4000);
  });

  test('scan-not-found stops polling', () => {
    expect(pollInterval(state({ error: new ApiError(404, 'scan-not-found'), errorUpdateCount: 1 }))).toBe(false);
  });
});
