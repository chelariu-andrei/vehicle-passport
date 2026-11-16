import { useQuery } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';

/** The signed-in account. TanStack refetches it whenever the app returns to the foreground (focusManager follows AppState). */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => unwrap(await api.GET('/me')),
  });
}
