import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, isApiError, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

import { claimStore } from '../model/claimStore';
import { LOCAL_CLAIMS } from './useLocalClaims';

/**
 * The row goes whenever the claim is no longer pending: withdrawn (204), already decided (409) or unknown (404, P9).
 * The last two still throw, so the caller can say "That claim was already decided."
 */
export function useWithdrawClaim() {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: async (claimId: string) => {
      if (userId === null) throw new Error('Not signed in');
      try {
        unwrap(await api.POST('/ownership-claims/{claimId}/withdraw', { params: { path: { claimId } } }));
      } catch (error) {
        if (isApiError(error, 'claim-not-pending', 'claim-not-found')) await claimStore.remove(userId, claimId);
        throw error;
      }
      await claimStore.remove(userId, claimId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [LOCAL_CLAIMS] }),
  });
}
