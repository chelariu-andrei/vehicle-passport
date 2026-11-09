import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';

import { api, errorMessage, isApiError, qk, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';
import { toast } from '@/shared/design';
import { en } from '@/shared/i18n/en';

import { inboxRow, isActive } from '../model/inboxRow';
import type { InboxAction, ScanStatus } from '../model/inboxRow';
import { nextPollDelay } from '../model/polling';
import { scanJobStore } from '../model/scanJobStore';
import { LOCAL_SCANS, uploadScans } from './uploadScans';

export type InboxRowModel = {
  id: string;
  vin: string;
  submittedAt: string;
  localUri: string;
  status: ScanStatus;
  label: string;
  action: InboxAction;
  /** A retry needs the kept photo. */
  canRetry: boolean;
};

function fileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** The jobs this phone submitted, each kept up to date by polling while the screen is focused (integration 3.4). */
export function useScanJobs() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const focused = useIsFocused();
  const handled = useRef(new Set<string>());

  const local = useQuery({
    queryKey: [LOCAL_SCANS, userId],
    enabled: userId !== null,
    queryFn: async () => (await scanJobStore.list(userId!)).map((job) => ({ job, canRetry: fileExists(job.localUri) })),
  });
  const entries = local.data ?? [];

  const polls = useQueries({
    queries: entries.map(({ job }) => ({
      queryKey: qk.scan(job.jobId),
      queryFn: async () => unwrap(await api.GET('/scans/{jobId}', { params: { path: { jobId: job.jobId } } })),
      enabled: focused,
      // Only a job still being read is asked again; the first answer is attempt 0.
      refetchInterval: (query: { state: { data?: { status: ScanStatus }; dataUpdateCount: number } }) =>
        isActive(query.state.data?.status) ? nextPollDelay(Math.max(0, query.state.dataUpdateCount - 1)) : false,
    })),
  });

  const refreshLocal = () => queryClient.invalidateQueries({ queryKey: [LOCAL_SCANS] });
  const forget = async (jobId: string) => {
    await scanJobStore.remove(userId!, jobId);
    await refreshLocal();
  };

  // Jobs that finished, or that the server no longer knows, leave the inbox. Each is handled once.
  // Runs after every render; the set makes it act once per job.
  useEffect(() => {
    if (userId === null) return;
    entries.forEach(({ job }, i) => {
      const status = polls[i].data?.status;
      const orphaned = isApiError(polls[i].error, 'scan-not-found');
      if (handled.current.has(job.jobId)) return;
      if (!orphaned && !(status && inboxRow(status).remove)) return;
      handled.current.add(job.jobId);
      if (status === 'CONFIRMED') {
        toast(en.scans.addedToHistory);
        void queryClient.invalidateQueries({ queryKey: qk.timeline(job.vin) });
      }
      void forget(job.jobId);
    });
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const entry = entries.find((e) => e.job.jobId === jobId);
      if (!entry || userId === null) return;
      const { job } = entry;
      const [fresh] = await uploadScans(job.vin, [{ uri: job.localUri, size: new File(job.localUri).size }]);
      await scanJobStore.replace(userId, jobId, { ...fresh, batchId: job.batchId });
    },
    onError: (error) => toast(errorMessage(error)),
    onSettled: refreshLocal,
  });

  const rows: InboxRowModel[] = entries.flatMap(({ job, canRetry }, i) => {
    const status = polls[i].data?.status ?? 'PENDING';
    const row = inboxRow(status);
    if (row.remove) return [];
    return [
      { id: job.jobId, vin: job.vin, submittedAt: job.submittedAt, localUri: job.localUri, status, label: row.label, action: row.action, canRetry },
    ];
  });

  return {
    rows,
    dismiss: (id: string) => void forget(id),
    retry: (id: string) => {
      if (!retryMutation.isPending) retryMutation.mutate(id);
    },
    isRetrying: retryMutation.isPending,
    query: {
      isPending: local.isPending,
      isError: local.isError,
      isRefetching: local.isRefetching,
      refetch: () => Promise.all([local.refetch(), ...polls.map((poll) => poll.refetch())]),
    },
  };
}
