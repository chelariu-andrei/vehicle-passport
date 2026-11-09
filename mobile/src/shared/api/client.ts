import createClient from 'openapi-fetch';

import { currentAuthPort } from '../auth/authPort';
import { createAuthedFetch } from './authedFetch';
import type { paths } from './generated/schema';

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  // Resolved per call so a fake installed by tests (or a later fetch replacement) is honoured.
  fetch: createAuthedFetch(currentAuthPort, (request) => globalThis.fetch(request)),
});
