import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { qk } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

import { isBlank, journeyDraftStore } from '../model/journeyDraft';
import type { JourneyDraft } from '../model/journeyDraft';

const DEBOUNCE_MS = 300;

/** The add-a-car draft of the signed-in account: read once, mirrored to the phone as it changes, gone after submit. */
export function useJourneyDraft() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: qk.journeyDraft(userId ?? ''),
    queryFn: () => journeyDraftStore.get(userId!),
    enabled: userId !== null,
    staleTime: Infinity,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiting = useRef<JourneyDraft | null>(null);

  const stopTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  /** Writes `draft` now. Nothing typed means no draft at all. */
  const saveNow = useCallback(
    (draft: JourneyDraft) => {
      if (userId === null) return;
      stopTimer();
      waiting.current = null;
      if (isBlank(draft)) {
        queryClient.setQueryData(qk.journeyDraft(userId), null);
        void journeyDraftStore.clear(userId);
        return;
      }
      queryClient.setQueryData(qk.journeyDraft(userId), draft);
      void journeyDraftStore.set(userId, draft);
    },
    [queryClient, userId],
  );

  /** Writes `draft` once typing pauses. */
  const save = useCallback(
    (draft: JourneyDraft) => {
      waiting.current = draft;
      stopTimer();
      timer.current = setTimeout(() => {
        if (waiting.current) saveNow(waiting.current);
      }, DEBOUNCE_MS);
    },
    [saveNow],
  );

  /** Forgets the draft, and any write still waiting. */
  const clear = useCallback(() => {
    stopTimer();
    waiting.current = null;
    if (userId === null) return;
    queryClient.setQueryData(qk.journeyDraft(userId), null);
    void journeyDraftStore.clear(userId);
  }, [queryClient, userId]);

  // Leaving the screen must not lose the last keystrokes still waiting for the pause.
  useEffect(
    () => () => {
      if (waiting.current) saveNow(waiting.current);
    },
    [saveNow],
  );

  return { loaded: !query.isPending, draft: query.data ?? null, save, saveNow, clear };
}
