import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';
import { useSession } from '@/shared/auth/session';

import { claimStore } from '../model/claimStore';
import type { LocalClaim } from '../model/claimStore';
import { LOCAL_CLAIMS } from './useLocalClaims';
import type { VehicleResponse } from './useVehicles';

type RegisterRequest = components['schemas']['RegisterVehicleRequest'];
export type RegisterResult = { kind: 'created'; vehicle: VehicleResponse } | { kind: 'claimFiled'; claim: LocalClaim };

/** 201 adds the car. 202 means someone else owns the VIN: nothing is created and the filed claim is remembered. */
export function useRegisterVehicle() {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: async (body: RegisterRequest): Promise<RegisterResult> => {
      if (userId === null) throw new Error('Not signed in');
      const result = await api.POST('/vehicles', { body });
      const data = unwrap(result);
      if (result.response.status === 202) {
        const filed = data as components['schemas']['ClaimFiledResponse'];
        const claim = { claimId: filed.claimId, vin: body.vin, filedAt: filed.filedAt };
        await claimStore.upsert(userId, claim);
        return { kind: 'claimFiled', claim };
      }
      return { kind: 'created', vehicle: data as VehicleResponse };
    },
    onSuccess: (result) => {
      if (result.kind === 'created') queryClient.setQueryData(qk.vehicle(result.vehicle.vin), result.vehicle);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.vehicles }),
        queryClient.invalidateQueries({ queryKey: [LOCAL_CLAIMS] }),
      ]),
  });
}
