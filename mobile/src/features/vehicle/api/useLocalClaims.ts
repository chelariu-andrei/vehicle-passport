import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useSession } from '@/shared/auth/session';

import { claimStore } from '../model/claimStore';

/** Prefix for invalidation. These are on-device rows, not server state, so they sit outside `qk`. */
export const LOCAL_CLAIMS = 'localClaims';

/**
 * The claims this phone filed that are still waiting. Waits for the garage list: a claim whose VIN is in the
 * garage was approved, so reading it also deletes it.
 */
export function useLocalClaims(garageVins: readonly string[] | undefined) {
  const { userId } = useSession();
  return useQuery({
    queryKey: [LOCAL_CLAIMS, userId, garageVins?.join(',')],
    queryFn: () => claimStore.dropResolved(userId!, garageVins!),
    enabled: userId !== null && garageVins !== undefined,
    // The list changes whenever the garage does; keep showing the old rows until the new ones are read.
    placeholderData: keepPreviousData,
  });
}
