import { nextPollDelay } from './polling';

test('polling starts at 2 s, backs off and settles at 10 s', () => {
  expect([0, 1, 2, 3, 4].map(nextPollDelay)).toEqual([2000, 4000, 8000, 10000, 10000]);
});
