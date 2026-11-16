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

## The 3D car

The car is built in code: no model file, no network. `viewer/car-kit.js` and `viewer/stage.js` mirror the design system's `CarViewer` and are copied from it, not edited here. `npm run build:viewer` bundles them with `viewer/main.js` into `assets/viewer/viewer.html` (generated, never edited by hand); run it after changing anything in `viewer/`.

The viewer needs a WebView, so the web build shows the flat silhouette instead.

The dev screen `/dev/viewer` cycles the seven body types and four finishes and shows the frame rate. Each body type must hold 30 fps on a mid-range phone; if one does not, lower the pixel-ratio cap in `viewer/stage.js` to 1.5 and rebuild. If it still misses, set `CAR_VIEWER_ENABLED = false` in `src/shared/viewer/config.ts` to ship silhouettes everywhere (the owner's call).

## Release notes for the car look

The app sends `plate` and `appearance` on `PATCH /vehicles/{vin}` and reads them from `VehicleResponse`. The backend must ship both before the feature is released; until then the app treats a missing field as none. The plate is owner-only and never part of a passport.

## Account, sign-in & legal

The app has email and password, Apple and Google sign-in, a consent gate, an account area (profile, settings, sign-in methods, app lock, support, acknowledgements) and data export with account deletion.

- Env: besides the Supabase and API values above, set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (see `env.example`). Set them as EAS environment variables for cloud builds.
- Native config in `app.json`: `usesAppleSignIn` for iOS, and the Google plugin `iosUrlScheme`, which is a placeholder (`com.googleusercontent.apps.REPLACE_WITH_IOS_CLIENT_ID`) and must be replaced with the reversed iOS client ID before an iOS build.
- Apple sign-in is iOS only. Google works on iOS and Android.
- Apple, Google and local authentication use native modules, so Expo Go cannot run them. Use a dev build: `eas build --profile development`.
- Supabase needs the Apple and Google providers enabled with the same client IDs (`infra/supabase/config.toml`), and `vehiclepassport://reset-password` in the redirect allow-list.
- Licences: `npm run gen:licenses` regenerates `licenses.json` for the acknowledgements screen from `package-lock.json`; `npm run check:licenses` fails when it is stale and runs as part of `npm run check`. Run the generator after changing dependencies.
- Manual end-to-end checklist for the real-device run: `docs/e2e-account.md`.
