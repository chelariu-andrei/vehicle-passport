# Buyer passport page

A small server-rendered site (Hono on Node 24, run with type stripping, no build step) that shows a frozen
passport to a buyer who scanned the QR. Read-only, no owner data, no app-install prompt.

- Routes: `GET /public/passports/<token>` and `GET /public/passports/<token>/pdf`.
- Fetches the API server-side, without an Authorization header. The token is never logged.
- Every response carries `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`.

## Run

```
API_BASE_URL=http://localhost:8080 PORT=3000 npm start
```

`API_BASE_URL` is required. `PORT` defaults to 3000.

## Connect it to the API

Set `PASSPORT_PUBLIC_BASE_URL` on the API to this site's base URL. The API builds each passport's
`publicUrl` as `PASSPORT_PUBLIC_BASE_URL + /public/passports/<token>`. The setting is read when a passport
is created and the PDF is generated then, so passports created earlier keep the old link in their PDF.

## Checks

`npm run check` runs `tsc --noEmit` and the Gherkin scenarios in `features/`.
`npm run gen:tokens` regenerates `src/tokens.generated.ts` from `mobile/design/tokens.json`.
