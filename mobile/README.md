# Vehicle Passport mobile app

Expo owner app. `contracts/openapi.yaml` is the source of the API types (`npm run gen:api`).

## Run it

Copy `env.example` to `.env` and fill in:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_API_URL` | The backend on this computer's LAN address, for example `http://192.168.1.10:8080`. A phone cannot reach `localhost`. |
| `EXPO_PUBLIC_SUPABASE_URL` | Local stack: `http://<LAN address>:54321` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | The publishable key from `npx supabase status -o env`, run in `infra/` |

Start local Supabase with `npx supabase start` in `infra/`, and the backend as described in `server/README.md`. Then run `npx expo start --lan`. The phone and the computer must be on the same network.

Hosted Supabase must keep email confirmation off. The app has no email-confirmation flow beyond telling the user to check their inbox.

## Check it

`npm run check` runs types, lint, contract freshness and all tests.

## Build it

`eas.json` has two profiles: `development` (dev client) and `internal` (TestFlight and the Play internal track).

- Set the three `EXPO_PUBLIC_*` values as EAS environment variables.
- Internal builds need an HTTPS API, because release builds refuse cleartext traffic.
- iOS builds run in the EAS cloud, because development is on Windows.
