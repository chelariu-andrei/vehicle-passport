import { isApiError } from '@/shared/api';

import { isActive } from './inboxRow';
import type { ScanStatus } from './inboxRow';

/** Milliseconds to wait before the next status check: 2 s, doubling, never more than 10 s (integration 3.4). */
export function nextPollDelay(attempt: number): number {
  return Math.min(2000 * 2 ** attempt, 10_000);
}

type PollState = {
  data?: { status: ScanStatus };
  error: unknown;
  dataUpdateCount: number;
  errorUpdateCount: number;
};

/**
 * When to ask about a job again, or `false` to stop. Keeps going while the job is being read, and also while there is
 * no answer yet because a poll failed; stops at any other status and when the server no longer knows the job.
 */
export function pollInterval(state: PollState): number | false {
  if (isApiError(state.error, 'scan-not-found')) return false;
  if (state.data && !isActive(state.data.status)) return false;
  return nextPollDelay(Math.max(0, state.dataUpdateCount + state.errorUpdateCount - 1));
}
