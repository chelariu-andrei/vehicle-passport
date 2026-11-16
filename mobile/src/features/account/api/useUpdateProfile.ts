import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

type Me = components['schemas']['MeResponse'];
export type ProfilePatch = components['schemas']['ProfilePatch'];

/** PATCH /me. The cached account changes at once and is put back if the server refuses. */
export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch) => unwrap(await api.PATCH('/me', { body: patch })),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: qk.me });
      const previous = client.getQueryData<Me>(qk.me);
      if (previous) client.setQueryData<Me>(qk.me, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) client.setQueryData(qk.me, context.previous);
    },
    onSuccess: (me) => {
      client.setQueryData(qk.me, me);
    },
  });
}
