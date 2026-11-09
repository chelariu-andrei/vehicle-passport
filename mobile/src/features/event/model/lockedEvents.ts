import { useSyncExternalStore } from 'react';

import { onSessionEnd } from '@/shared/auth/session';

/**
 * Events the server refused to change because a previous owner added them (integration 3.3). The API does not
 * say up front which events those are, so once one is seen its actions stay hidden for the rest of the session.
 */
let locked: ReadonlySet<string> = new Set();
const subscribers = new Set<() => void>();

function replace(next: ReadonlySet<string>): void {
  locked = next;
  subscribers.forEach((notify) => notify());
}

export const lockedEvents = {
  lock: (id: string) => {
    if (!locked.has(id)) replace(new Set(locked).add(id));
  },
  has: (id: string) => locked.has(id),
  clear: () => {
    if (locked.size > 0) replace(new Set());
  },
};

// The next account on this phone must not inherit what this one learned.
onSessionEnd(lockedEvents.clear);

export function useIsLocked(id: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => void subscribers.delete(notify);
    },
    () => locked.has(id),
  );
}
