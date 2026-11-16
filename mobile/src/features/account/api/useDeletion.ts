import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, isApiError, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

import { useMe } from './useMe';

type Me = components['schemas']['MeResponse'];

function useSetDeletion() {
  const client = useQueryClient();
  return (deletion: Me['deletion']) => client.setQueryData<Me>(qk.me, (me) => (me ? { ...me, deletion } : me));
}

/** POST /me/deletion. A 409 means a date already stands: the account is read again so that date is shown. */
export function useScheduleDeletion() {
  const client = useQueryClient();
  const setDeletion = useSetDeletion();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/me/deletion')),
    onSuccess: (status) => setDeletion({ scheduledFor: status.scheduledFor }),
    onError: async (error) => {
      if (isApiError(error, 'deletion-already-scheduled')) await client.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/** DELETE /me/deletion. A 404 means nothing was scheduled any more: the account is read again so the banner follows the server. */
export function useCancelDeletion() {
  const client = useQueryClient();
  const setDeletion = useSetDeletion();
  return useMutation({
    mutationFn: async () => unwrap(await api.DELETE('/me/deletion')),
    onSuccess: () => setDeletion(null),
    onError: async (error) => {
      if (isApiError(error, 'deletion-not-scheduled')) await client.invalidateQueries({ queryKey: qk.me });
    },
  });
}

/** The date the account is deleted on, or null when no deletion is scheduled (or the account has not loaded). */
export function useScheduledDeletion(): string | null {
  return useMe().data?.deletion?.scheduledFor ?? null;
}
