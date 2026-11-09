import { useQuery } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

/** Newest first. There is no get-by-id, so the detail screen reads from this list. */
export function usePassports() {
  return useQuery({ queryKey: qk.passports, queryFn: async () => unwrap(await api.GET('/passports')) });
}
