# Account (mobile) — follow-ups

Work that the account/sign-in/consent PR (`feat/account-mobile`) deliberately did **not** fix. Found by the per-task and whole-branch reviews. Plan: `docs/superpowers/plans/2026-11-15-account-mobile.md`.

Priority: **P0** blocks release, **P1** before/soon after release, **P2** polish or tech debt.

## P0 — before any device build or release

- [ ] Replace the placeholder `iosUrlScheme` in `mobile/app.json` (`com.googleusercontent.apps.REPLACE_WITH_IOS_CLIENT_ID`) with the real Google iOS client ID.
- [ ] Add `vehiclepassport://reset-password` to the **hosted** Supabase redirect allow-list (local `infra/supabase/config.toml` is already done).
- [ ] Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (EAS env + local `.env`).
- [ ] Run the end-to-end checklist `mobile/docs/e2e-account.md` on a dev build with real Apple/Google credentials and fill in the results column. Not run so far.
- [ ] Manual device checks (tests cannot prove these): lock Modal presents above an open ConfirmSheet / native-stack modal on iOS; biometric prompt over the lock Modal does not loop on Android; Account-tab dot for pending deletion draws as a dot; Android share-sheet behaviour for the export file.
- [ ] Google on iOS: if sign-in is rejected for a nonce mismatch, review `skip_nonce_check` (`infra/supabase/config.toml` locally / provider settings hosted). `google.ts` sends no nonce.

## P1 — correctness, privacy, store review

- [ ] **Settings carry over between accounts**: `SettingsSync` pushes the phone's stored language/appearance into the next account's server settings after sign-out/sign-in on the same phone.
- [ ] **Apple full name is discarded**: `getAppleCredential` returns it, `session.ts` drops it. Apple only sends it once. Persist it (user metadata / profile) at first sign-in.
- [ ] **Android sign-in methods**: the screen hides Apple on Android but still counts it in `onlyOne`; an Apple+email account can remove email on Android and then cannot sign in there. Password change/unlink also skip the app-lock check (deletion does ask).
- [ ] **Consent source after a failed auto-accept**: when the person then ticks the gate themselves, `useConsent.ts` records `sign-up-form` / `social-sign-up` by `acceptedVersion === null` rather than the real path.
- [ ] **Pending consent for an already-registered email** (email confirmation ON): Supabase returns no error, so the flag is saved for that existing email and can auto-accept for its real owner within 7 days.
- [ ] **No reaction to `403 consent-required`**: a mid-session terms bump only reopens the gate on next focus. `errorMessage.ts` also logs "Unknown API error code" for `consent-required`, `deletion-*`, `legal-document-not-found`.
- [ ] **Consent overlay not hidden from screen readers**: the loading/error cover is visual only; add `importantForAccessibility="no-hide-descendants"` / `accessibilityElementsHidden` on the Stack beneath.
- [ ] **App-switcher privacy cover**: nothing hides the app in the OS task-switcher snapshot when the lock is on. Also `immediately` timeout locks on Notification Centre pull-down (`inactive`).
- [ ] **Lock off with no passcode**: when `authenticate()` can never succeed the lock cannot be turned off; `authFailedOff` should tell the person to set a device passcode.
- [ ] **Brand logos on `SocialButton`**: Apple/Google brand guidelines (App Review risk).
- [ ] **Duplicate control**: "Product news" exists as notification setting `productNews` and as the marketing consent — decide on one and wire the other to it.
- [ ] **Email "Connect"** in Sign-in methods is missing (no session function to add an email+password identity). Add "add email and password".
- [ ] **Sign-in biometric "returning state"** (plan Task 9) not delivered; the lock overlay is the only biometric mechanism.
- [ ] **Email sign-up fetches terms versions at submit time**, not when the form was shown; up to 5 s wait if the endpoint is slow. `AsyncStorage.setItem` in `useSignUp` is unguarded — a storage failure blocks sign-up instead of proceeding without the flag.

## P1 — Romanian coverage gaps

- [ ] English-only strings on new screens: server error messages (`errorMessage`), `ConsentGateScreen` 409 copy, `ProfileScreen` errors, `SupportScreen` API errors, `ErrorState` default copy, legal-document error states.
- [ ] Vehicle / scans / passport / event screens still import `en` directly (out of scope of this plan).
- [ ] Remove unused i18n keys `support.failed` / `support.unknown`; use `account.loadError` as ProfileScreen's error title.
- [ ] `en.auth.and` builds sentences by concatenation; use one templated string per sentence.

## P2 — code quality and tests

- [ ] Extract `Checkbox` and `ChoiceGroup` primitives (checkbox duplicated in `TermsCheckbox.tsx` / `DeleteAccountScreen.tsx`; radio pills in `SecurityScreen`, `SupportScreen`, `OptionGroup`).
- [ ] `useIdentities.ts` keeps its own query key outside `qk`; wrong comment in `useSettings.ts:10` (contract exempts `/me*` from the consent check).
- [ ] `Markdown.tsx` opens `mailto:` with `openBrowserAsync` (does not work); headings don't render inline markdown; link regex truncates URLs containing `)`.
- [ ] `package.json`: `@react-native-google-signin/google-signin` uses a caret; every other dependency is `~`/exact.
- [ ] Optimistic updates without `onSettled` invalidation / concurrent-mutation handling: `useUpdateSettings`, `useUpdateProfile`, privacy-choices switches (double-toggle can finish out of order).
- [ ] Settings sync is one-way by design (a phone that has chosen never adopts another device's value) — document it in code.
- [ ] Zod `zodResolver(...) as never` casts (`CredentialsForm`, `ForgotPasswordScreen`, `ResetPasswordScreen`).
- [ ] Reset-password: guard the one-time code exchange against effect double-invocation; "Request a new link" bounces a signed-in user to `/` (forgot-password isn't exempt); no AppBar/back on `ResetPasswordScreen`.
- [ ] Acknowledgements: `META_NAMES` regex uses unanchored `metro`/`hermes-` prefixes; optional lock entries (e.g. `@pkgjs/parseargs`) excluded; Apache/MPL packages rely on shipped licence files; `kael` handle accepted as copyright holder.
- [ ] Licence/Markdown/consent tests: add missing cases — `linkProvider`/`listIdentities`, invalid legal `type`, fake API ignores `locale`, public legal ops in handler-existence test, `resolveLocale` cases `'ro_RO'`/`'RO'`/`''`, `getMe >= 2` assertion in consent steps is loose, date formatting test only covers `en-GB`, whitespace-only name for a name-less account, late success after the 15 s consent fallback, lock-over-sheet test only checks Modal props.
- [ ] Test infra: File mock `removed` is never cleared by `create`; harness `openApp` pre-accepts the account; `test/setup.ts` clears AsyncStorage per test (verify nothing relies on leakage).
- [ ] Tooling: `eas.json` not modified (env names documented in README instead); `infra/SUPABASE-LOCAL.md` is referenced in docs but does not exist; `AppLockBoundary.tsx` JSX attributes use single quotes while the rest of the repo uses double.
- [ ] Support: `collectDiagnostics()` runs on every render; password rule counts characters, not bytes (bcrypt 72-byte limit); client rejects C1 control chars the server accepts; `PLAY_SERVICES_NOT_AVAILABLE` maps to `'other'` instead of `'provider-unavailable'`.
- [ ] Lock settings are per device and survive sign-out; `walletLocked` is stored with no UI; storage read errors fall back to lock disabled (fail-open, documented).
