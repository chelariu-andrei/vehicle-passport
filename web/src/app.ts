import { Hono } from 'hono';
import { messagePage, passportPage, TEMPORARY, UNAVAILABLE } from './render.ts';
import { parseSnapshot } from './snapshot.ts';

export type Deps = { apiBaseUrl: string; fetch: typeof fetch };

const PROTECT: Record<string, string> = {
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

function protectedResponse(res: Response): Response {
  // Rebuild so headers are mutable even on a response passed through from fetch.
  const out = new Response(res.body, res);
  for (const [name, value] of Object.entries(PROTECT)) out.headers.set(name, value);
  return out;
}

/** The token is a bearer capability: it is never logged, and every response carries the protective headers. */
export function createApp(deps: Deps): Hono {
  const app = new Hono();
  const base = deps.apiBaseUrl.replace(/\/+$/, '');
  const upstream = (token: string, suffix = '') =>
    deps.fetch(`${base}/public/passports/${encodeURIComponent(token)}${suffix}`, {
      headers: { Accept: suffix ? 'application/pdf' : 'application/json' },
    });

  app.use('*', async (c, next) => {
    await next();
    c.res = protectedResponse(c.res);
  });

  const unavailable = (c: import('hono').Context) => c.html(messagePage(UNAVAILABLE), 404);
  const temporary = (c: import('hono').Context) => c.html(messagePage(TEMPORARY), 502);

  app.get('/public/passports/:token', async (c) => {
    let res: Response;
    try {
      res = await upstream(c.req.param('token'));
    } catch {
      return temporary(c);
    }
    if (res.status === 404) return unavailable(c);
    if (!res.ok) return temporary(c);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return temporary(c);
    }
    const root = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const snapshot = parseSnapshot(root.snapshot);
    if (!snapshot || typeof root.hash !== 'string' || typeof root.algorithm !== 'string') return temporary(c);

    const pdfHref = `/public/passports/${encodeURIComponent(c.req.param('token'))}/pdf`;
    return c.html(passportPage(snapshot, root.hash, root.algorithm, pdfHref));
  });

  app.get('/public/passports/:token/pdf', async (c) => {
    let res: Response;
    try {
      res = await upstream(c.req.param('token'), '/pdf');
    } catch {
      return temporary(c);
    }
    if (res.status === 404) return unavailable(c);
    if (!res.ok) return temporary(c);
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="vehicle-passport.pdf"',
      },
    });
  });

  app.notFound((c) => unavailable(c));
  app.onError((_err, c) => temporary(c));
  return app;
}
