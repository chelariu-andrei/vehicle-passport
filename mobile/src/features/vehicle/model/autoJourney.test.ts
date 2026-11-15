import { autoJourney } from './autoJourney';

const empty = { status: 'empty', claimsLoaded: true, claimCount: 0 } as const;

beforeEach(() => autoJourney.reset());

test('starts for an empty garage with its claims read and none pending', () => {
  expect(autoJourney.shouldStart(empty)).toBe(true);
});

test.each([
  ['the garage is still loading', { ...empty, status: 'loading' }],
  ['the garage failed to load', { ...empty, status: 'error' }],
  ['there is a car', { ...empty, status: 'ready' }],
  ['the claims are not read yet', { ...empty, claimsLoaded: false }],
  ['a claim is waiting', { ...empty, claimCount: 1 }],
] as const)('does not start while %s', (_name, input) => {
  expect(autoJourney.shouldStart(input)).toBe(false);
});

test('"Later" holds it back until reset', () => {
  autoJourney.dismiss();
  expect(autoJourney.shouldStart(empty)).toBe(false);
  autoJourney.reset();
  expect(autoJourney.shouldStart(empty)).toBe(true);
});
