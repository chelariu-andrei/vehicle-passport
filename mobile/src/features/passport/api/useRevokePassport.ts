import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

/** Idempotent and final. Whatever the answer, the list is read again: a 404 means it is already gone. */
export function useRevokePassport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/passports/{id}/revoke', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.passports }),
  });
}
