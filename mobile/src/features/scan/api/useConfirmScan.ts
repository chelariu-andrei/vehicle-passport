import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';
import { toast } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import type { ConfirmScanRequest } from '../model/confirmRequest';
import { scanJobStore } from '../model/scanJobStore';
import { LOCAL_SCANS } from './uploadScans';

/**
 * The one action that creates a DOCUMENTED event. The job leaves the device first, so the inbox does not announce
 * it a second time when it next polls.
 */
export function useConfirmScan(jobId: string, vin: string | undefined) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  return useMutation({
    mutationFn: async (body: ConfirmScanRequest) =>
      unwrap(await api.POST('/scans/{jobId}/confirm', { params: { path: { jobId } }, body })),
    onSuccess: async () => {
      toast(en.scans.addedToHistory);
      if (userId !== null) await scanJobStore.remove(userId, jobId);
      await queryClient.invalidateQueries({ queryKey: [LOCAL_SCANS] });
      void queryClient.invalidateQueries({ queryKey: vin ? qk.timeline(vin) : ['timeline'] });
      // Marked stale only: the open review must not refetch a job that is now CONFIRMED and flash a status panel.
      void queryClient.invalidateQueries({ queryKey: qk.scan(jobId), refetchType: 'none' });
    },
  });
}
