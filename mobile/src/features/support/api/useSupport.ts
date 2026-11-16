import { useMutation } from '@tanstack/react-query';

import { api, unwrap } from '@/shared/api';
import type { components } from '@/shared/api/generated/schema';

export type SupportReport = components['schemas']['SupportReportRequest'];

/** POST /support/reports. Sends only what the caller built, so diagnostics never travel unless asked for. */
export function useCreateSupportReport() {
  return useMutation({
    mutationFn: async (report: SupportReport) => unwrap(await api.POST('/support/reports', { body: report })),
  });
}
