import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

import { scanJobStore } from '../model/scanJobStore';
import { LOCAL_SCANS } from './uploadScans';

/** Rejects the job; on 204 it leaves the inbox. */
export function useRejectScan(jobId: string) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/scans/{jobId}/reject', { params: { path: { jobId } } })),
    onSuccess: async () => {
      if (userId !== null) await scanJobStore.remove(userId, jobId);
      await queryClient.invalidateQueries({ queryKey: [LOCAL_SCANS] });
      void queryClient.invalidateQueries({ queryKey: qk.scan(jobId), refetchType: 'none' });
    },
  });
}
