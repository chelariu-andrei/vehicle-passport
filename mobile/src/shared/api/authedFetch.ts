import type { AuthPort } from '../auth/authPort';

/**
 * Adds the bearer token. An empty 401 refreshes the session once (shared by every request in flight)
 * and retries once; a second 401 or a refused refresh signs out.
 */
export function createAuthedFetch(auth: AuthPort, baseFetch: typeof fetch): (request: Request) => Promise<Response> {
  let refreshing: Promise<string | null> | null = null;
  const refreshOnce = () => {
    refreshing ??= auth.refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const send = (pristine: Request, token: string | null) => {
    const attempt = pristine.clone();
    if (token) attempt.headers.set('Authorization', `Bearer ${token}`);
    return baseFetch(attempt);
  };

  return async (request) => {
    // Integration 2.2: /public/** is anonymous, so no token, no refresh and no sign-out.
    if (new URL(request.url).pathname.startsWith('/public/')) return baseFetch(request);
    const pristine = request.clone(); // a consumed body cannot be sent twice
    const usedToken = await auth.getAccessToken();
    const response = await send(pristine, usedToken);
    if (response.status !== 401 || (await response.clone().text()) !== '') return response;

    // Another request may have refreshed since this one left; use that token rather than refreshing again.
    const current = await auth.getAccessToken();
    const fresh = current && current !== usedToken ? current : await refreshOnce();
    if (!fresh) {
      await auth.signOutLocal();
      return response;
    }
    const retried = await send(pristine, fresh);
    if (retried.status === 401) await auth.signOutLocal();
    return retried;
  };
}
