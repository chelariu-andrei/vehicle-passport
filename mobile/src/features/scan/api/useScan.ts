import { useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

import { scanJobStore } from '../model/scanJobStore';
import type { LocalScanJob } from '../model/scanJobStore';
import { LOCAL_SCANS } from './uploadScans';

const getScan = async (jobId: string) => unwrap(await api.GET('/scans/{jobId}', { params: { path: { jobId } } }));

/** One job as the server has it. The review opens only on `EXTRACTED`, so there is no polling here. */
export function useScan(jobId: string) {
  return useQuery({ queryKey: qk.scan(jobId), queryFn: () => getScan(jobId) });
}

/** The job as it is now, whatever was cached: used to find the next invoice of a batch. */
export const fetchScan = (queryClient: QueryClient, jobId: string) =>
  queryClient.fetchQuery({ queryKey: qk.scan(jobId), queryFn: () => getScan(jobId), staleTime: 0 });

/** What this phone remembers about the job (its car, photo and batch), and the other jobs of its batch. */
export function useLocalScan(jobId: string): { job: LocalScanJob | undefined; batchmates: LocalScanJob[]; isPending: boolean } {
  const { userId } = useSession();
  const query = useQuery({
    queryKey: [LOCAL_SCANS, 'review', userId],
    enabled: userId !== null,
    queryFn: () => scanJobStore.list(userId!),
  });
  const all = query.data ?? [];
  const job = all.find((j) => j.jobId === jobId);
  const batchmates = job?.batchId ? all.filter((j) => j.batchId === job.batchId && j.jobId !== jobId) : [];
  return { job, batchmates, isPending: query.isPending };
}
