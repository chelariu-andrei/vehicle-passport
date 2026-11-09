import { serve } from '@hono/node-server';
import { createApp } from './app.ts';

const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) {
  console.error('API_BASE_URL is required');
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3000);

// No request logging: the URL path carries the passport token.
serve({ fetch: createApp({ apiBaseUrl, fetch }).fetch, port }, () => {
  console.log(`Buyer page listening on port ${port}`);
});
