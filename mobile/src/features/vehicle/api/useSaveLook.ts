import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import { appearanceOf, plateToSend } from '@/shared/viewer';
import type { Look } from '@/shared/viewer';

/** Saves the whole look in one update. The plate goes only through here; an empty one is sent as null. */
export function useSaveLook(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (look: Look) =>
      unwrap(
        await api.PATCH('/vehicles/{vin}', {
          params: { path: { vin } },
          body: { appearance: appearanceOf(look), plate: plateToSend(look.plate) },
        }),
      ),
    meta: { vin },
    onSuccess: (vehicle) => {
      queryClient.setQueryData(qk.vehicle(vin), vehicle);
      return queryClient.invalidateQueries({ queryKey: qk.vehicles });
    },
  });
}
