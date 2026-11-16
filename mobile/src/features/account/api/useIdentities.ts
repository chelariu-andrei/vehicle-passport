import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { linkProvider, listIdentities, unlinkIdentity, type SocialProvider } from '@/shared/auth/session';

const KEY = ['identities'] as const;

/** The ways the signed-in account can sign in. */
export function useIdentities() {
  return useQuery({ queryKey: KEY, queryFn: listIdentities });
}

/** Resolves 'cancelled' (not a failure) when the person closes the Apple or Google sheet. */
export function useLinkProvider() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (provider: SocialProvider) => linkProvider(provider),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnlinkIdentity() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unlinkIdentity(id),
    onSettled: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
