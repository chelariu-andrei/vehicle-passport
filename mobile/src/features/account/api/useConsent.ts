import { useMutation, useQueryClient } from '@tanstack/react-query';

import { clearPendingConsent, matchesAccount, readPendingConsent, shownVersionsMatch } from '@/features/auth';
import { api, isApiError, qk, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';
import type { components } from '@/shared/api/generated/schema';

import type { Me } from '../model/consentGate';

type ConsentStatus = components['schemas']['ConsentStatus'];

export interface AcceptInput {
  /** The status the person was shown; the versions accepted are the ones they could read. */
  consent: ConsentStatus;
  marketing?: boolean;
  analytics?: boolean;
}

/** Records acceptance of the terms and privacy versions in `consent`. A 409 means they changed meanwhile: the texts are reloaded. */
export function useAcceptConsent() {
  const client = useQueryClient();
  const { email } = useSession();
  return useMutation({
    mutationFn: async ({ consent, marketing, analytics }: AcceptInput) => {
      // Only the account that signed up with the form can claim its acceptance.
      const stored = await readPendingConsent();
      // ...and only if what they were shown is what is being recorded.
      const versions = { terms: consent.terms.currentVersion, privacy: consent.privacy.currentVersion };
      const pending = stored && matchesAccount(stored, email) && shownVersionsMatch(stored, versions) ? stored : null;
      const source = pending ? 'sign-up-form' : consent.terms.acceptedVersion === null ? 'social-sign-up' : 're-consent';
      const status = unwrap(
        await api.POST('/me/consents', {
          body: {
            accept: [
              { type: 'terms', version: consent.terms.currentVersion },
              { type: 'privacy', version: consent.privacy.currentVersion },
            ],
            ...(marketing === undefined ? {} : { marketing }),
            ...(analytics === undefined ? {} : { analytics }),
            source,
          },
        }),
      );
      if (stored) await clearPendingConsent();
      return status;
    },
    onSuccess: (status) => {
      client.setQueryData<Me>(qk.me, (me) => (me ? { ...me, consent: status } : me));
      void client.invalidateQueries({ queryKey: qk.me });
    },
    onError: (error) => {
      if (isApiError(error, 'consent-version-outdated')) {
        void client.invalidateQueries({ queryKey: qk.me });
        void client.invalidateQueries({ queryKey: ['legalDocument'] });
        void client.invalidateQueries({ queryKey: ['legalDocuments'] });
      }
    },
  });
}
