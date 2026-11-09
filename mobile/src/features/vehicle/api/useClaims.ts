import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type PendingClaim = components['schemas']['PendingClaimResponse'];

/** Claims waiting on this car. Only the id and the filing date exist: the claimant is anonymous by design. */
export function useClaims(vin: string) {
  return useQuery({
    queryKey: qk.claims(vin),
    queryFn: async () => unwrap(await api.GET('/vehicles/{vin}/claims', { params: { path: { vin } } })),
    meta: { vin },
  });
}

/** Approving hands the car away. The caller leaves the screen, then forgets the car's cached queries. */
export function useApproveClaim(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string) =>
      unwrap(await api.POST('/vehicles/{vin}/claims/{claimId}/approve', { params: { path: { vin, claimId } } })),
    meta: { vin },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.vehicles }),
        queryClient.invalidateQueries({ queryKey: qk.passports }),
      ]),
  });
}

/** Refreshes the list whatever the answer: a 409 means someone else decided first. */
export function useRejectClaim(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (claimId: string) =>
      unwrap(await api.POST('/vehicles/{vin}/claims/{claimId}/reject', { params: { path: { vin, claimId } } })),
    meta: { vin },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.claims(vin) }),
  });
}
