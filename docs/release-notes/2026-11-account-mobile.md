# Account, sign-in and legal (mobile)

Branch `feat/account-mobile`. Status: implemented and passing `npm run check` (types, lint, contract, licence freshness, 658 jest tests). The manual end-to-end run on a dev build has NOT been performed yet; see `mobile/docs/e2e-account.md`.

## What users get

- Sign in or sign up with Apple (iOS only), Google (iOS and Android), or email and password, with validated forms.
- Terms of Service and Privacy Policy pages (Romanian and English) and a consent gate that must be accepted before using the app.
- An Account tab with profile (name, phone), settings (language Romanian, English or system; appearance; distance unit; currency; notifications and reminder days) and marketing consent.
- Sign-in methods: change password, connect and disconnect methods.
- Optional app lock with biometrics or device passcode.
- Support (report a problem, ask a question), About, and open-source acknowledgements.
- Export of the user's data, and account deletion with a cancellable grace period. The Account tab shows a dot while deletion is pending.
- Password reset by emailed link.

## Known limitations and manual checks

- The legal texts are placeholders pending legal review (`V9__legal_seed.sql`).
- Connecting an email and password to a social-only account is not available (email Connect is missing).
- Transitive licence attributions are generated from `package-lock.json`, not hand-curated.
- Native-only behaviour is unverified on device: Apple and Google sign-in, app lock presenting above an open sheet or native modal on iOS, the Android biometric prompt not looping over the lock modal, share-sheet export and file cleanup.
- The password reset link uses PKCE, so it only works on the device that requested it.
- The pending-consent flag for email sign-up is a single slot: a second sign-up on the same device before confirmation overwrites the first.
- `mobile/app.json` carries a placeholder Google `iosUrlScheme` that must be replaced before an iOS build.
- `infra/supabase/config.toml` allow-lists `vehiclepassport://` only; `vehiclepassport://reset-password` must be added for the reset link.
- `config.toml` refers to `infra/SUPABASE-LOCAL.md`, which does not exist in the repo.
