# Account end-to-end checklist (manual)

Status: NOT YET RUN. This file is a script for a human tester. The Result column stays blank until someone runs the step on a real dev build, and the tester fills it in (PASS / FAIL + note).

Nothing here has been verified on a device or against real Apple or Google credentials. `npm run check` (types, lint, contract, licences, jest) passes, but it does not exercise the native modules.

## 1. Prerequisites

1. Local Supabase stack from `infra/supabase/config.toml`: run `npx supabase start` in `infra/`. Use the list below for the rest of the setup.
2. Provider secrets exported before starting the stack (names from `config.toml`):
   - `SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID` (comma-separated accepted audiences: bundle ID `com.vehiclepassport.app`, optionally a Services ID) and `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`
   - `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` (comma-separated: web client ID first, then iOS, then Android) and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
3. Redirect allow-list: `additional_redirect_urls` must accept `vehiclepassport://reset-password` (entries are exact URLs). The committed `infra/supabase/config.toml` has it for the local stack; any hosted project needs the same entry added by hand before testing section 7.
4. Backend running against that stack (see `server/README.md`). Do not point it at a shared database.
5. Mobile `.env` (copy `mobile/env.example`): `EXPO_PUBLIC_API_URL` (LAN address), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
6. `mobile/app.json`: the `@react-native-google-signin/google-signin` plugin has `iosUrlScheme` set to the placeholder `com.googleusercontent.apps.REPLACE_WITH_IOS_CLIENT_ID`. It MUST be replaced with the reversed iOS client ID before building for iOS.
7. Apple: the App ID `com.vehiclepassport.app` has the Sign In with Apple capability (`usesAppleSignIn` is already true in `app.json`); a Services ID is only needed if you also list it as an audience. Apple sign-in is iOS only.
8. Google: OAuth clients for web and iOS (and Android with the app's SHA-1 for Android sign-in) in Google Cloud.
9. Dev build: `eas build --profile development` (iOS builds run in the EAS cloud). Expo Go cannot run the Apple, Google and local-authentication native modules. Set the `EXPO_PUBLIC_*` values as EAS environment variables.
10. Postgres access to the stack's database for the verification queries (schema `vehicle_passport`).

Record the test run:

| Field | Value |
|---|---|
| Tester / date | |
| Build (profile, commit) | |
| Devices (iOS version, Android version) | |
| Server commit | |

## 2. Google sign-up, full account flow

Use a Google account that has never signed in before.

Note for Google on iOS: if Google sign-in is rejected for a nonce mismatch, see `skip_nonce_check` in `infra/supabase/config.toml` (local) / provider settings (hosted).

| # | Step | Expected | Result |
|---|---|---|---|
| 2.1 | Sign-in screen, tap Continue with Google | Native Google sheet, then the app lands on the consent gate, not Home | |
| 2.2 | On the consent gate, try to continue without accepting | Blocked: terms and privacy must be accepted | |
| 2.3 | Open Terms and Privacy links from the gate | Legal pages render (placeholder text is expected) | |
| 2.4 | Accept terms and privacy, continue | Home tabs open; gate does not return after app restart | |
| 2.5 | Run query A | One `user_profile`, one `user_settings`; `consent_record` rows for `terms` and `privacy`, `granted = true`, `source = 'social-sign-up'`, versions matching the current `legal_document` | |
| 2.6 | Account tab: edit display name and phone (try an invalid phone first) | Invalid phone rejected inline; valid E.164 saves; reopening shows the saved values | |
| 2.7 | Run query B | `display_name` and `phone` updated | |
| 2.8 | Settings: change distance unit, currency, appearance, notification toggles and reminder days | Changes apply immediately and survive a restart | |
| 2.9 | Run query C | Values match the UI | |
| 2.10 | Account > Privacy choices: marketing on, then off (and the same for analytics) | The switches move at once and keep their state after leaving and reopening the screen. Two new `consent_record` rows, `type = 'marketing'`, `granted` true then false, `source = 'settings'` (and the same for `type = 'analytics'`); the `terms` and `privacy` rows are unchanged (append-only) | |
| 2.10a | Turn the server off (or go offline) and flip a Privacy choices switch | The switch goes back and a "couldn't save" message appears; no new `consent_record` row | |
| 2.11 | Export my data | Share sheet opens with a data file containing profile, settings, consents and vehicle data | |
| 2.12 | Schedule account deletion (confirm dialog) | Account tab shows the pending deletion state with a date; the Account tab icon shows a dot | |
| 2.13 | Run query B | `deletion_scheduled_for` is set | |
| 2.14 | Cancel deletion | Pending state and dot disappear; `deletion_scheduled_for` is null again | |

## 3. Apple sign-up (iOS only)

| # | Step | Expected | Result |
|---|---|---|---|
| 3.1 | Compare the sign-in screen on iOS and Android | Continue with Apple is shown on iOS only | |
| 3.2 | Sign in with Apple, once with "Share my email" and once (new Apple ID or after revoking) with "Hide my email" | Consent gate, then Home; profile row exists (`email` may be the relay address or null) | |
| 3.3 | Sign out, sign in with Apple again | Goes straight in; gate not shown again | |
| 3.4 | Sign-in methods screen | Apple listed as a connected method | |

## 4. Email sign-up with confirmation and pending consent

`config.toml` has `enable_confirmations = false` for email. Turn it on for this section and restart the stack, then turn it back off. (`mobile/README.md` says hosted Supabase keeps confirmation off for the standard flow; this section deliberately tests the confirmation path.)

| # | Step | Expected | Result |
|---|---|---|---|
| 4.1 | Sign up with email and password, ticking terms and privacy | Validation messages on bad input; success tells the user to check the inbox | |
| 4.2 | Query `consent_record` before confirming | Consent is held on the device as pending; no rows for the user yet | |
| 4.3 | Open the confirmation email link, then sign in | Sign-in works; pending consent is written (`source = 'sign-up-form'`) and the gate is not shown | |
| 4.5 | Turn `enable_confirmations` back off and restart the stack. Sign up with a new email, ticking terms and privacy | Lands on Home without the consent gate (no second ticking). Query A: `terms` and `privacy` rows with `source = 'sign-up-form'` and the current versions; exactly one pair | |
| 4.6 | With confirmation off, sign up with an email that already has an account | "Email already in use" style error on the email field; no consent rows added or changed for that account | |
| 4.4 | Sign up a second email on the same device before confirming the first | Consent flag is single-slot: only the latest sign-up's consent is kept (known limitation). Record what happens | |

## 5. Sign-in methods

| # | Step | Expected | Result |
|---|---|---|---|
| 5.1 | Change password | Validation applies; new password works after sign-out | |
| 5.2 | Connect or disconnect a social method | Reflected in the list; the last remaining method cannot be removed | |
| 5.3 | On a social-only account, look for connecting email and password | Not available in this release (known gap); confirm the UI offers no broken path | |

## 6. App lock

| # | Step | Expected | Result |
|---|---|---|---|
| 6.1 | Enable app lock in Security on a phone with biometrics enrolled | Biometric prompt confirms enabling. On a phone with no biometrics enrolled the switch cannot be turned on and says why; the device passcode is only the fallback once the lock is on | |
| 6.2 | Background the app past the lock delay, return | Lock screen shown; unlock restores the previous screen | |
| 6.3 | iOS manual check: open a sheet or native modal (for example the export share sheet or a picker), background and return | The lock presents above the open sheet or modal | |
| 6.4 | Android manual check: on the lock modal, trigger the biometric prompt | The prompt does not loop (no repeated re-prompt after cancel or success) | |
| 6.5 | Cancel biometrics, use the fallback | Fallback or retry works; app stays locked until success | |
| 6.6 | Disable app lock | The biometric (or passcode fallback) check is asked for first; after it passes there is no lock on next return | |
| 6.7 | Lock screen: press Sign out | The session ends, the lock closes and the sign-in screen is shown; signing in again does not show the old lock | |

## 7. Password reset (PKCE, device-bound)

| # | Step | Expected | Result |
|---|---|---|---|
| 7.1 | Forgot password, enter the email, open the email on the same device | Link opens the app at `vehiclepassport://reset-password?code=...` with the new password form | |
| 7.2 | Set a new password | Success; sign in with it | |
| 7.3 | Request a reset on device A, open the link on device B | Fails with a clear message (the PKCE verifier lives on the requesting device only). Known limitation | |
| 7.4 | Reuse the same link | Rejected as expired or used | |

## 8. Language

| # | Step | Expected | Result |
|---|---|---|---|
| 8.1 | Settings: language Romanian | The migrated screens switch to Romanian: Account, Profile, Consent gate (including its loading and retry screen), Legal, Auth, Settings, Security (and the lock screen), Support, Delete account and Privacy choices. NOT expected in Romanian: vehicle, scan, passport and event screens, server error messages, and ErrorState default texts | |
| 8.2 | Query C | `language = 'ro'` | |
| 8.3 | Language System, phone set to Romanian then English | Follows the phone | |
| 8.4 | Legal pages in Romanian | Romanian documents load | |

## 9. Support and acknowledgements

| # | Step | Expected | Result |
|---|---|---|---|
| 9.1 | Send a problem report and a question | Success message; one `support_report` row per submission (query D) | |
| 9.2 | Acknowledgements screen | Direct and transitive dependencies listed with licence text | |

## 10. Export file cleanup

| # | Step | Expected | Result |
|---|---|---|---|
| 10.1 | Export, then cancel the share sheet | No leftover export file in the app cache | |
| 10.2 | Export, save to Files, reopen the app | The temporary export file is removed | |
| 10.3 | Export from a second account | Contains only that user's data | |

## 11. Deletion edge cases

| # | Step | Expected | Result |
|---|---|---|---|
| 11.1 | Schedule deletion, kill the app, relaunch | Dot and pending state persist (server state) | |
| 11.2 | Sign out and in during the grace period | Pending state still shown; cancel works | |
| 11.3 | After the grace date passes and the server purge runs | Account gone; the old token is refused (`erased_account` has the id); signing in creates a fresh account | |

## Verification queries

Replace `<user-id>` with the Supabase auth user id (`auth.users.id`). Names come from `server/src/main/resources/db/migration/V8__account.sql` and `V10__erased_account.sql`.

A. Provisioning and consent:

```sql
select id, email, display_name, phone, created_at, deletion_scheduled_for
from vehicle_passport.user_profile where id = '<user-id>';

select * from vehicle_passport.user_settings where user_id = '<user-id>';

select type, version, granted, source, created_at
from vehicle_passport.consent_record
where user_id = '<user-id>' order by created_at;

select type, locale, version, is_current
from vehicle_passport.legal_document where is_current;
```

B. Profile and deletion state:

```sql
select display_name, phone, deletion_scheduled_for
from vehicle_passport.user_profile where id = '<user-id>';
```

C. Settings:

```sql
select language, appearance, distance_unit, currency,
       notif_document_deadlines, notif_reminder_days, notif_scans,
       notif_passport_views, notif_transfers, notif_product_news
from vehicle_passport.user_settings where user_id = '<user-id>';
```

D. Support reports and erased accounts:

```sql
select kind, message, created_at from vehicle_passport.support_report where user_id = '<user-id>';
select * from vehicle_passport.erased_account where id = '<user-id>';
```
