/** Milliseconds to wait before the next status check: 2 s, doubling, never more than 10 s (integration 3.4). */
export function nextPollDelay(attempt: number): number {
  return Math.min(2000 * 2 ** attempt, 10_000);
}
