# Account, Social Sign-in & Legal — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal Account tab and email-only auth with the full Account experience from the design-system artifact: Apple + Google sign-in, validated sign-in/sign-up, Terms/Privacy/consent pages, profile, settings, security, support, data export and account deletion — all persisted through the backend and in sync with the contract.

**Architecture:** Supabase Auth stays the session provider; Apple/Google use native id tokens exchanged with `supabase.auth.signInWithIdToken`. Server-owned data (profile, settings, consents, legal text, deletion, export, support) goes through the generated `openapi-fetch` client with React Query hooks in a new `features/account` and `features/legal`. A consent gate in the root `Shell` routes to `/consent` until `me.consent.required` is false. Validation is zod, mirroring the server rules exactly.

**Tech Stack:** Expo ~58 / expo-router, React Native 0.88, `@supabase/supabase-js`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-local-authentication`, react-hook-form + zod, React Query, jest-expo + RNTL + jest-cucumber.

**Spec:** none separate — design from the *Vehicle Passport* design-system artifact (`AccountScreen`, `AuthScreen`, `SocialSignIn`, `SettingsRow`); decisions in the backend plan. **Facebook is dropped; only Apple + Google.**
**Depends on:** `docs/superpowers/plans/2026-11-15-account-backend.md` Task 1 (contract). Tasks 4+ need the backend tasks 4–10 only for real end-to-end; tests use the fake API.

## Decisions

- **Providers per platform:** iOS shows Apple (first) + Google; **Android shows Google only**. Apple is native (`expo-apple-authentication`), iOS only, no web OAuth flow. Web build: social buttons hidden (out of scope).
- **Google:** native `@react-native-google-signin/google-signin`, `signInWithIdToken`. Both need a dev build (already using `expo-dev-client`), not Expo Go.
- Email + password stays alongside social. Identity link/unlink, password change, sign-out-others use the Supabase client (no server endpoint).
- App lock is local only (`expo-local-authentication` + `expo-secure-store`).
- Languages: `system | ro | en`. New minimal i18n runtime; Romanian covers only the new auth/account/legal/consent strings, everything else falls back to `en`.

## Global Constraints

- Contract first: run `npm run gen:api` after the backend Task 1 lands; `npm run check:contract` and the operations-covered test must stay green; every new operation gets fake-API coverage in `test/fake-api/`.
- All user-facing copy in `src/shared/i18n/en.ts` (and `ro.ts` for the new sections). No hard-coded strings in components.
- Validation (identical to server): `displayName` trimmed 1–80, no control chars; `phone` empty or `^\+[1-9]\d{6,14}$`; email RFC-simple + max 254; password ≥ 8 (Supabase minimum) and ≤ 72; support message 10–4000.
- Errors under the field they belong to, never clear the email on error; a cancelled provider sheet is silent.
- Reuse design primitives (`Screen`, `AppBar`, `Card`, `Field`, `Button`, `ConfirmSheet`, `Toast`, `Text`) and tokens; add `SettingsRow` / `SettingsGroup` / `Switch` / `SocialButton` primitives under `src/shared/design/primitives/`.
- Run `npm test`, `npm run typecheck`, `npm run lint` before each commit (`cd mobile`). Commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Apple/Google cancel (`ERR_REQUEST_CANCELED`, `SIGN_IN_CANCELLED`) → no error toast, form untouched. (Task 4)
- Apple "Hide My Email" / no name returned → account still created; name prompted on Profile, not blocking. (Tasks 3, 7)
- Same email already registered with the other provider/password → friendly "use your original method" message, not a raw Supabase string. (Task 4)
- Offline while the consent gate loads → retry state, never a blank screen and never auto-accept. (Task 6)
- Terms version bumped while the app is open → next `/me` refetch (focus) re-opens the gate; 409 on accept refetches versions. (Task 6)
- Disconnecting the last remaining sign-in method must be impossible. (Task 9)
- Deletion pending → banner + dot on the Account tab; signing out must not hide it on next login. (Task 11)
- Pasting a phone with spaces/dashes → normalised before send, error only if still invalid. (Task 2, 7)

## File Structure

(`mobile/`)
- `app.json`, `package.json`, `eas.json` — plugins (`expo-apple-authentication`, google-signin, local-authentication), `ios.usesAppleSignIn`, env names
- `src/shared/validation/{email,password,profile,phone,support}.ts` + `index.ts` — zod schemas + `normalizePhone`
- `src/shared/auth/session.ts` (modify) — `signInWithApple`, `signInWithGoogle`, `sendPasswordReset`, `updatePassword`, `listIdentities`, `linkProvider`, `unlinkIdentity`, `signOutOthers`
- `src/shared/auth/social/{apple.ts,google.ts,nonce.ts}` — provider adapters returning `{idToken, nonce, fullName?}`
- `src/shared/design/primitives/{SettingsRow,SettingsGroup,Switch,SocialButton,Avatar,Markdown}.tsx`
- `src/shared/i18n/{index.ts,ro.ts}` + `en.ts` (modify) — runtime `t()`/`useT()`, locale resolution
- `src/features/auth/components/{SignInScreen,SignUpScreen,CredentialsForm,ProvidersBlock,ForgotPasswordScreen,ResetPasswordScreen,BiometricOfferSheet}.tsx`
- `src/features/legal/{api/useLegal.ts,components/{LegalIndexScreen,LegalDocumentScreen}.tsx,index.ts}`
- `src/features/account/api/{useMe,useUpdateProfile,useSettings,useConsent,useDeletion,useExport,useSupport}.ts`
- `src/features/account/components/{AccountScreen,ProfileScreen,SignInMethodsScreen,SecurityScreen,NotificationsScreen,LanguageScreen,AppearanceScreen,UnitsScreen,SupportScreen,AcknowledgementsScreen,DeleteAccountScreen,ConsentGateScreen,DeletionBanner}.tsx`
- `src/features/account/model/{appLock.ts,consentGate.ts}`
- `app/(auth)/{forgot-password,reset-password}.tsx`, `app/consent.tsx`, `app/account/{profile,sign-in-methods,security,notifications,language,appearance,units,support,acknowledgements,delete}.tsx`, `app/account/legal/{index,[type]}.tsx` — thin route files
- `app/_layout.tsx` (modify) — consent + deletion awareness in `Shell`
- `scripts/gen-licenses.mjs` → `src/shared/generated/licenses.json`
- `features/{account,auth-social,consent,legal,deletion}.feature` + steps, `test/fake-api/*`, `test/fakes/auth.ts` (modify)

---

### Task 1: Dependencies, native config, contract types

**Files:**
- Modify: `package.json`, `app.json`, `eas.json`, `.env.example`
- Test: `src/shared/api/__tests__/operationsCovered.test.ts` (existing)

**Interfaces:**
- Produces env names `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; `app.json` has `ios.usesAppleSignIn: true`; generated `paths` include `/me`, `/me/settings`, `/me/consents`, `/me/consents/history`, `/me/deletion`, `/me/export`, `/support/reports`, `/public/legal/documents[/{type}]`.

- [ ] **Step 1:** `npx expo install expo-apple-authentication expo-local-authentication` and `npm i @react-native-google-signin/google-signin`; add config plugins in `app.json`.
- [ ] **Step 2:** `npm run gen:api` (backend Task 1 merged) → `npm run check:contract`. Expected: operations-covered test FAILS listing the new operations.
- [ ] **Step 3:** Add fake-API handlers + builders (`aMe`, `aSettings`, `aConsentStatus`, `aLegalDocument`) in `test/fake-api/` for every new operation, with `consent.required` toggle and version-mismatch (409) support.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run lint` → PASS. Commit `chore(mobile): social-auth deps and account contract`.

### Task 2: Validation module

**Files:**
- Create: `src/shared/validation/*`
- Test: `src/shared/validation/__tests__/validation.test.ts`

**Interfaces:**
- Produces: `emailSchema`, `passwordSchema`, `displayNameSchema`, `phoneSchema` (accepts `''`), `supportMessageSchema`, `normalizePhone(raw: string): string` (strips spaces, dashes, parentheses; keeps leading `+`).

- [ ] **Step 1:** Tests: `emailRejectsMissingAt`, `emailTrimsAndLowercases`, `passwordRejectsSevenChars`, `passwordRejectsOver72`, `displayNameRejectsBlankAfterTrim`, `displayNameRejectsControlChars`, `normalizePhoneStripsSeparators("+40 712-345 678") === "+40712345678"`, `phoneRejectsNoPlus`, `phoneAcceptsEmptyToClear`, `supportMessageBounds`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(mobile): shared validation`.

### Task 3: Session layer — social, identities, password

**Files:**
- Create: `src/shared/auth/social/{apple.ts,google.ts,nonce.ts}`
- Modify: `src/shared/auth/session.ts`, `src/shared/auth/supabase.ts`, `test/fakes/auth.ts`
- Test: `src/shared/auth/__tests__/social.test.ts`

**Interfaces:**
- Produces in `session.ts`: `signInWithApple(): Promise<SocialResult>`, `signInWithGoogle(): Promise<SocialResult>` where `SocialResult = 'signedIn' | 'cancelled'`; `AuthFailed` gains `'account-exists-other-provider'`, `'provider-unavailable'`; `sendPasswordReset(email): Promise<void>`; `updatePassword(newPassword): Promise<void>`; `listIdentities(): Promise<{provider:'email'|'apple'|'google', id:string}[]>`; `linkProvider(p:'apple'|'google')`, `unlinkIdentity(id)` (throws `'last-identity'` when only one remains); `signOutOthers(): Promise<void>` (`scope:'others'`).
- Adapters: `getAppleCredential(): Promise<{idToken, nonce, fullName?}|null>` (null = cancelled); `getGoogleCredential(): Promise<{idToken}|null>`; nonce = random raw value, SHA-256 hash sent to Apple, raw to Supabase (`expo-crypto`).

- [ ] **Step 1:** Tests: `appleCancelledReturnsCancelledWithoutError`, `googleCancelledReturnsCancelled`, `appleSendsRawNonceToSupabaseAndHashedToApple`, `appleFullNameReturnedOnFirstSignIn`, `existingEmailOtherProviderMapsToAccountExists`, `unlinkLastIdentityThrows`, `signOutOthersUsesOthersScope`, `appleUnavailableOnAndroid` (`signInWithApple` throws `'provider-unavailable'` when `Platform.OS !== 'ios'`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per signatures; Apple is guarded by `Platform.OS === 'ios'`; there is no Android Apple path. **Step 4:** PASS. **Step 5:** Commit `feat(mobile): social sign-in session layer`.

### Task 4: Sign-in / Sign-up screens

**Files:**
- Create: `ProvidersBlock.tsx`, `SocialButton.tsx`, `ForgotPasswordScreen.tsx`, `ResetPasswordScreen.tsx`, `app/(auth)/forgot-password.tsx`, `app/(auth)/reset-password.tsx`
- Modify: `SignInScreen.tsx`, `SignUpScreen.tsx`, `CredentialsForm.tsx`, `src/shared/i18n/en.ts`
- Test: `features/auth-social.feature` + steps; component tests next to each screen

**Interfaces:**
- Consumes: Task 2 schemas, Task 3 session functions.
- Produces: `ProvidersBlock({mode:'in'|'up'})` — Apple first and only on iOS, then Google (Android renders Google alone); "Continue with …" labels; caption under them on `up` ("By continuing you accept Terms and Privacy", both tappable → legal screens). `CredentialsForm` uses react-hook-form + zod; sign-up shows name + terms checkbox; "Create account" disabled until ticked; password show/hide; "Forgot password?" on sign-in. Sign-up with `confirmationRequired` shows existing message and stores `pendingConsent: {termsAccepted:true}` in AsyncStorage (used by Task 6).

- [ ] **Step 1:** Scenarios (`auth-social.feature`): *Apple button appears first on iOS*, *Android shows only the Google button*, *Google sign-in succeeds and lands on the garage*, *cancelling Google shows nothing*, *email already used with Apple shows the other-provider message*, *sign-up needs the terms box*, *invalid email shows error under the field and keeps the value*, *wrong password shows the mismatch message*, *forgot password sends a reset and confirms*.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement screens; reset-password route reads the recovery session from the deep link (`vehiclepassport://reset-password`) then calls `updatePassword`. **Step 4:** Run full suite → PASS. **Step 5:** Commit `feat(mobile): apple and google sign-in, validated auth forms`.

### Task 5: Legal pages (Terms, Privacy, data sharing)

**Files:**
- Create: `src/features/legal/**`, `src/shared/design/primitives/Markdown.tsx`, `app/account/legal/{index,[type]}.tsx`
- Test: `features/legal.feature`, `Markdown.test.tsx`

**Interfaces:**
- Produces: `useLegalDocuments(locale)`, `useLegalDocument(type: 'terms'|'privacy'|'data-sharing', locale)` (React Query, `staleTime` 1h, key in `queryKeys.ts`); `<Markdown source={string} />` supporting `#`/`##`/`###`, paragraphs, `-` lists, `**bold**`, links (opened with `expo-web-browser`); no HTML. Legal screens are reachable signed-out (from sign-up caption) via a `(auth)`-accessible route `app/(auth)/legal/[type].tsx` re-exporting `LegalDocumentScreen`.

- [ ] **Step 1:** Tests: `markdownRendersHeadingsAndLists`, `markdownIgnoresRawHtml`, scenarios *Terms open from the sign-up caption while signed out*, *Legal list shows version and effective date*, *document falls back to English when locale unsupported*, *offline shows retry*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(mobile): terms and privacy pages from the API`.

### Task 6: Consent gate

**Files:**
- Create: `ConsentGateScreen.tsx`, `src/features/account/api/{useMe,useConsent}.ts`, `src/features/account/model/consentGate.ts`, `app/consent.tsx`
- Modify: `app/_layout.tsx` (`Shell`)
- Test: `features/consent.feature`

**Interfaces:**
- Produces: `useMe()` (key `queryKeys.me`, refetch on app focus); `useAcceptConsent()` → `POST /me/consents` with `source` = `'sign-up-form'` when `pendingConsent` exists, else `'social-sign-up'` (first session) or `'re-consent'`; `resolveGate(me, pending): 'open'|'consent'|'loading'|'error'`. Gate screen: summary + links to Terms/Privacy, required checkbox, two optional switches (marketing, analytics, default off), primary "Accept and continue", secondary "Sign out".
- `Shell`: signed in + gate ≠ open → `<Redirect href="/consent">`; gate error → retry screen.

- [ ] **Step 1:** Scenarios: *new Apple user is taken to the consent screen*, *accept is disabled until the box is ticked*, *optional switches default off*, *sign-up with ticked box and pending consent skips the gate*, *new terms version re-opens the gate on focus*, *409 outdated version reloads the texts*, *offline shows retry and never opens the app*, *sign out from the gate works*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** full suite PASS. **Step 5:** Commit `feat(mobile): consent gate`.

### Task 7: Account root + Profile

**Files:**
- Create: `SettingsRow/SettingsGroup/Switch/Avatar` primitives, `ProfileScreen.tsx`, `useUpdateProfile.ts`, `DeletionBanner.tsx`, `app/account/profile.tsx`
- Modify: `AccountScreen.tsx`, `app/(tabs)/account.tsx`
- Test: `features/account.feature` (extend)

**Interfaces:**
- Produces: Account root per artifact order — profile card (initials avatar, name or email fallback, counts from `me.stats`), groups Account / Security / Preferences / Help / About, Sign out in its own group, Delete account in its own group, version line. `useUpdateProfile()` → `PATCH /me`, optimistic, rolls back on error; Profile form: name (required), email read-only with verified state, phone optional using `normalizePhone`; Apple users without a name are prompted inline (non-blocking).

- [ ] **Step 1:** Scenarios: *profile card shows name, email and counts*, *edit name persists after reload*, *phone with spaces is normalised and saved*, *invalid phone shows field error*, *clearing phone sends null*, *server validation error is shown under the field*, *sign out is separate from delete*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(mobile): account home and profile`.

### Task 8: i18n runtime + settings (language, appearance, units, notifications)

**Files:**
- Create: `src/shared/i18n/{index.ts,ro.ts}`, `useSettings.ts`, `NotificationsScreen`, `LanguageScreen`, `AppearanceScreen`, `UnitsScreen` + routes
- Modify: `en.ts`, `ThemeProvider` (read appearance from settings)
- Test: `features/settings.feature`, `src/shared/i18n/__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `useT(): (key: KeyPath, params?) => string`, `resolveLocale(pref: 'system'|'ro'|'en', deviceLocale: string): 'ro'|'en'`; missing `ro` key falls back to `en`. `useSettings()` / `useUpdateSettings()` (`PUT /me/settings`, optimistic, whole object). Changes apply immediately; no Save button. Appearance syncs to the existing local theme preference so it works offline.

- [ ] **Step 1:** Tests: `resolveLocaleSystemRomanianDevice`, `missingRoKeyFallsBackToEn`, scenarios *switching to Română re-renders the Account tab at once*, *toggling a notification persists*, *reminder chips 30/7/1 toggle individually*, *product news is off by default*, *failed save reverts the switch and shows a toast*, *units and currency persist*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(mobile): settings and language`.

### Task 9: Sign-in methods + Security (app lock)

**Files:**
- Create: `SignInMethodsScreen.tsx`, `SecurityScreen.tsx`, `BiometricOfferSheet.tsx`, `model/appLock.ts`, routes
- Modify: `app/_layout.tsx` (lock overlay on foreground), `SignInScreen` (biometric returning state)
- Test: `features/security.feature`

**Interfaces:**
- Produces: `appLock` store `{enabled, timeout:'immediately'|'1m'|'5m', walletLocked}` persisted in SecureStore; `shouldLock(lastBackgroundedAt, now, timeout): boolean`; `authenticate(): Promise<boolean>` via `expo-local-authentication` (passcode fallback). Sign-in methods screen: Apple (iOS only), Google, email — "Connect"/"Disconnect" via `linkProvider/unlinkIdentity`; last method's Disconnect is disabled with a hint; "Change password" (email identity only). Security: Face ID/fingerprint switch, lock timeout segment, "Sign out everywhere else" with `ConfirmSheet`. Biometric offer shown once after the first successful sign-in.

- [ ] **Step 1:** Tests: `shouldLockAfterTimeout`, `shouldNotLockWithinTimeout`, scenarios *last sign-in method cannot be disconnected*, *connecting Google shows it connected*, *change password validates length*, *app locks after 1 minute in background and unlocks with biometrics*, *failed biometrics keeps the app locked*, *sign out everywhere else asks for confirmation*, *offer sheet appears once and never again after Not now*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(mobile): sign-in methods and app lock`.

### Task 10: Support, Legal list, Acknowledgements

**Files:**
- Create: `SupportScreen.tsx`, `useSupport.ts`, `AcknowledgementsScreen.tsx`, `scripts/gen-licenses.mjs`, `src/shared/generated/licenses.json`, routes
- Modify: `package.json` (`gen:licenses`, included in `check`), Account root About/Help rows
- Test: `features/support.feature`

**Interfaces:**
- Produces: `useCreateSupportReport()` → `POST /support/reports`; diagnostics (`appVersion`, `platform`, `osVersion`, `deviceModel` from `expo-constants`/`expo-device` info already available) sent only when the switch is on, with the exact fields listed under the switch. Acknowledgements lists packages from the generated file with licence text on tap.

- [ ] **Step 1:** Scenarios: *report under 10 characters shows an error*, *diagnostics switch off sends no diagnostics*, *successful report shows confirmation and clears the form*, *offline keeps the draft*, *acknowledgements list includes expo-router*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(mobile): support and acknowledgements`.

### Task 11: Export and delete account

**Files:**
- Create: `DeleteAccountScreen.tsx`, `useDeletion.ts`, `useExport.ts`, routes
- Modify: `DeletionBanner.tsx`, tab layout (dot on Account tab when `me.deletion`)
- Test: `features/deletion.feature`

**Interfaces:**
- Produces: `useScheduleDeletion()` (`POST /me/deletion`), `useCancelDeletion()` (`DELETE /me/deletion`), `useExportData()` → `GET /me/export`, writes `vehicle-passport-data.json` with `expo-file-system`, opens share sheet via `expo-sharing`. Delete screen: "Deleted for good" / "Stays with each car" cards, "Download my data first", "I understand" checkbox gating "Delete my account", `ConfirmSheet` using biometrics if lock is on, then "Deletion scheduled" with the date and "Cancel deletion". After scheduling the user stays signed in; the banner shows on Account until cancelled.

- [ ] **Step 1:** Scenarios: *delete button disabled until the box is ticked*, *scheduling shows the date 30 days out and a dot on the tab*, *cancel clears the banner and the dot*, *scheduling twice (409) shows the existing date*, *export shares a JSON file*, *export failure shows a toast*, *banner persists after sign-out and sign-in*.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(mobile): data export and account deletion`.

### Task 12: End-to-end sync check

**Files:**
- Modify: `docs/` release notes entry, `mobile/README` auth setup section
- Test: manual script `mobile/docs/e2e-account.md` + `npm run check`

- [ ] **Step 1:** Run `npm run check` (tests, typecheck, lint, contract, licences) → PASS.
- [ ] **Step 2:** Against local server (`quarkus_start`, Supabase local with provider credentials per `infra/SUPABASE-LOCAL.md`) on a dev build: sign up with Google → consent gate → accept → edit profile → change settings → export → schedule + cancel deletion; verify the rows in Postgres (`user_profile`, `user_settings`, `consent_record`).
- [ ] **Step 3:** Record the result honestly in the PR description, including anything not testable without real Apple/Google credentials. Commit `docs(mobile): account setup and e2e checklist`.

---

## Self-Review

- **Coverage:** Apple + Google → T3/T4 (+ backend T11 config); validations → T2 and each form; Terms/Privacy pages → T5; consents persisted and gated → T6; account page, profile, settings, security, help, about, delete, export → T7–T11; end-to-end → T12.
- **Gap vs. artifact:** Facebook removed; passkeys and "Talk to a person" phone card not planned (no phone number/hours yet). Apple is iOS-only and Google is on both platforms, as requested.
- **Types:** `MeResponse`, `ConsentStatus`, `SettingsDto`, `LegalDocument` names come from the generated schema (backend Task 1). `SocialResult`, `resolveGate`, `shouldLock` defined once in the tasks that produce them.
- **Known red window:** Task 1 is red until backend Task 1 is merged; `/consent` gate is off in fake API by default and only enabled in consent scenarios.
