import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

/** Gives the car up. The caller leaves the screen, then forgets the car's cached queries (`forgetVehicle`). */
export function useReleaseVehicle(vin: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/vehicles/{vin}/release', { params: { path: { vin } } })),
    meta: { vin },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.vehicles }),
        queryClient.invalidateQueries({ queryKey: qk.passports }),
      ]),
  });
}
