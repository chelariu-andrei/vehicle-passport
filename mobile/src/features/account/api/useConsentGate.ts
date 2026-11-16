import { useEffect, useRef, useState } from 'react';

import { readPendingConsent, type PendingConsent } from '@/features/auth';

import { resolveGate, type Gate } from '../model/consentGate';
import { useAcceptConsent } from './useConsent';
import { useMe } from './useMe';

/**
 * Where a signed-in person stands with the terms. A sign-up acceptance left by the email form is recorded once, without
 * the gate; if that fails the gate is shown and the person decides. Mounted only while signed in.
 */
export function useConsentGate(): { gate: Gate; retry: () => void } {
  const me = useMe();
  const { mutate } = useAcceptConsent();
  // undefined: still reading storage. null: nothing pending (or the automatic attempt failed).
  const [pending, setPending] = useState<PendingConsent | null | undefined>(undefined);
  const started = useRef(false);

  useEffect(() => {
    let live = true;
    void readPendingConsent().then((value) => live && setPending(value));
    return () => {
      live = false;
    };
  }, []);

  const consent = me.data?.consent;
  useEffect(() => {
    if (!pending || !consent?.required || started.current) return;
    started.current = true;
    // The flag is cleared by the mutation on success. On failure it stays, so the person's own acceptance on the gate is
    // still recorded as the sign-up form.
    mutate({ consent }, { onError: () => setPending(null) });
  }, [pending, consent, mutate]);

  return { gate: resolveGate(me, pending), retry: () => void me.refetch() };
}
