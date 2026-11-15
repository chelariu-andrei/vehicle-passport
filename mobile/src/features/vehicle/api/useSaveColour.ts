import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { PaintColor } from '@/shared/viewer';

/** Sets only the paint colour. The plate and the rest of the look are not part of the request. */
export function useSaveColour(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appearance: { color: PaintColor }) =>
      unwrap(await api.PATCH('/vehicles/{vin}', { params: { path: { vin } }, body: { appearance } })),
    meta: { vin },
    onSuccess: (vehicle) => {
      queryClient.setQueryData(qk.vehicle(vin), vehicle);
      return queryClient.invalidateQueries({ queryKey: qk.vehicles });
    },
  });
}
