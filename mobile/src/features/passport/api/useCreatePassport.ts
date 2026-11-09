import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

/** `expiresAt` null sends no request body at all (P17). */
export function useCreatePassport(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expiresAt: string | null) =>
      unwrap(
        await api.POST('/vehicles/{vin}/passports', {
          params: { path: { vin } },
          ...(expiresAt === null ? {} : { body: { expiresAt } }),
        }),
      ),
    meta: { vin },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.passports }),
  });
}
