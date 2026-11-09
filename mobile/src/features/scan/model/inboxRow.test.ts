import { inboxRow } from './inboxRow';

test.each([
  ['PENDING', 'Reading invoice…', 'none', false],
  ['PROCESSING', 'Reading invoice…', 'none', false],
  ['EXTRACTED', 'Ready to review', 'review', false],
  ['CONFIRMED', 'Added to history', 'none', true],
  ['REJECTED', 'Rejected', 'none', true],
  ['FAILED', "We couldn't read this invoice", 'failed', false],
  ['CANCELLED', 'Cancelled: this car left your garage', 'dismiss', false],
] as const)('%s row', (status, label, action, remove) => {
  expect(inboxRow(status)).toEqual({ label, action, remove });
});
