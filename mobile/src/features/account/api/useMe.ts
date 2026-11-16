import { useQuery } from '@tanstack/react-query';

import { api, qk, unwrap } from '@/shared/api';
import { useSession } from '@/shared/auth/session';

/** The signed-in account. TanStack refetches it whenever the app returns to the foreground (focusManager follows AppState). */
export function useMe() {
  // Once the session has ended there is nobody to ask about: a mounted screen must not refetch into a 401.
  const { status } = useSession();
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => unwrap(await api.GET('/me')),
    enabled: status === 'signedIn',
  });
}
