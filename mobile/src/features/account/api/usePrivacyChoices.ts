import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';
import { useSession } from '@/shared/auth/session';
import { toast } from '@/shared/design';
import { useStrings } from '@/shared/i18n';

import type { Me } from '../model/consentGate';

type ConsentStatus = components['schemas']['ConsentStatus'];
export type OptionalConsent = 'marketing' | 'analytics';

/** GET /me/consents: the optional choices as they stand now. */
export function useConsentStatus() {
  const { status } = useSession();
  return useQuery({
    queryKey: qk.consents,
    queryFn: async () => unwrap(await api.GET('/me/consents')),
    enabled: status === 'signedIn',
  });
}

/**
 * POST /me/consents with the one optional choice that changed, recorded as made in settings. The switch moves at once and
 * goes back, with a toast, if the server refuses. The terms and privacy acceptance is never part of it.
 */
export function useSetOptionalConsent() {
  const client = useQueryClient();
  const s = useStrings();
  return useMutation({
    mutationFn: async ({ key, value }: { key: OptionalConsent; value: boolean }) =>
      unwrap(await api.POST('/me/consents', { body: { [key]: value, source: 'settings' } })),
    onMutate: async ({ key, value }) => {
      await client.cancelQueries({ queryKey: qk.consents });
      const previous = client.getQueryData<ConsentStatus>(qk.consents);
      client.setQueryData<ConsentStatus>(qk.consents, (status) => (status ? { ...status, [key]: value } : status));
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(qk.consents, context.previous);
      toast(s.privacy.saveFailed);
    },
    onSuccess: (status) => {
      client.setQueryData(qk.consents, status);
      client.setQueryData<Me>(qk.me, (me) => (me ? { ...me, consent: status } : me));
    },
  });
}
