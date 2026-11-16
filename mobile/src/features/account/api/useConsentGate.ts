import { useEffect, useRef, useState } from 'react';

import { clearPendingConsent, matchesAccount, readPendingConsent, type PendingConsent } from '@/features/auth';
import { useSession } from '@/shared/auth/session';

import { resolveGate, type Gate } from '../model/consentGate';
import { useAcceptConsent } from './useConsent';
import { useMe } from './useMe';

/** How long the automatic acceptance may take before the person is shown the gate (with Sign out) instead of a spinner. */
export const AUTO_ACCEPT_TIMEOUT_MS = 15_000;

/**
 * Where a signed-in person stands with the terms. The acceptance left by the email sign-up form is recorded once, without
 * the gate, only for the account that signed up. It is forgotten when another account is signed in, when nothing is owed
 * or once recorded. If recording fails or takes too long the gate is shown and the person decides. Mounted only while signed in.
 */
export function useConsentGate(): { gate: Gate; retry: () => void } {
  const me = useMe();
  const { email } = useSession();
  const { mutate } = useAcceptConsent();
  // undefined: still reading storage. null: nothing pending for this account (none, forgotten, or the automatic attempt gave up).
  const [stored, setStored] = useState<PendingConsent | null | undefined>(undefined);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void readPendingConsent().then((value) => live && setStored(value));
    return () => {
      live = false;
      clearTimeout(timer.current);
    };
  }, []);

  const own = stored === undefined ? undefined : matchesAccount(stored, email) ? stored : null;
  const consent = me.data?.consent;

  useEffect(() => {
    if (!stored) return;
    // Someone else's acceptance, or nothing is owed: it must not be used later (a new version would be accepted unseen).
    if (own === null || (consent && !consent.required)) {
      void clearPendingConsent().then(() => setStored(null));
      return;
    }
    if (!consent?.required || started.current) return;
    started.current = true;
    const giveUp = () => setStored(null);
    timer.current = setTimeout(giveUp, AUTO_ACCEPT_TIMEOUT_MS);
    // The flag is cleared by the mutation on success. On failure it stays, so the person's own acceptance on the gate is
    // still recorded as the sign-up form.
    mutate(
      { consent },
      {
        onError: giveUp,
        onSuccess: () => setStored(null),
        onSettled: () => clearTimeout(timer.current),
      },
    );
  }, [stored, own, consent, mutate]);

  return { gate: resolveGate(me, own), retry: () => void me.refetch() };
}
