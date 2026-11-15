# Account, Consents & Legal — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the server an `account` feature (profile, settings, consents, versioned legal documents, account deletion, data export, support reports) so the mobile Account page, social sign-in gate and Terms/Privacy pages are fully persisted and contract-synced.

**Architecture:** New hexagonal feature `account` next to `vehicle/event/passport/scan`. Supabase Auth stays the identity provider (Apple + Google via `signInWithIdToken` on the mobile side); the server only sees the JWT `sub`/`email`, lazily provisions a `user_profile` row on first `/me`, and owns everything else. A consent gate filter returns `403 consent-required` on business endpoints until the current Terms + Privacy versions are accepted. Deletion is a 30-day soft schedule followed by a scheduled purge.

**Tech Stack:** Quarkus (REST Jackson, Panache, Flyway, Scheduler, OIDC, Hibernate Validator), PostgreSQL, Supabase Auth admin API (REST client), Cucumber + ArchUnit + RestAssured.

**Spec:** none separate — decisions are in "Decisions" below. Design source: the *Vehicle Passport* design-system artifact (`AccountScreen`, `AuthScreen`, `SocialSignIn`, `SettingsRow`). **Deviation from the artifact: Facebook is dropped; only Apple + Google.**
**Companion plan:** `docs/superpowers/plans/2026-11-15-account-mobile.md` (consumes the contract produced by Task 1 here).

## Decisions

- Providers: **Apple (iOS only, native id token) + Google (iOS and Android)**; email/password stays. Supabase needs the Apple provider enabled for id-token exchange but no web redirect flow for Apple. Provider sign-in lives entirely in Supabase; the server never sees provider tokens.
- Identity list / link / unlink / change password / sign-out-others are Supabase-client operations → **no server endpoint**.
- App lock (Face ID / fingerprint) is device-local → not persisted server-side.
- Legal text is persisted (`legal_document`, versioned, per locale) and served by the API; the seed text in V8 is **placeholder and needs legal review before release**.
- Deletion: 30-day grace, then purge. Technical history stays with each car, de-linked from the owner (matches the artifact's "Stays with each car").
- Migration numbers: event-attachments already claims `V6`; this plan uses `V7`, `V8`. If attachments merges after this, renumber on rebase.

## Global Constraints

- Contract first: edit `contracts/openapi.yaml` (Task 1), then server, then `npm run gen:api` in `mobile/` (companion plan).
- Hexagonal rules from `.claude/ARCHITECTURE.md`: `domain` pure; `api` never imports `infrastructure`; cross-feature calls only through the other feature's `application/port/in`.
- Error shape: `application/problem+json` via `ProblemResponse`; domain exceptions extend `DomainException` (`kind()` + `code()`). 401 keeps an empty body.
- Exact error codes: `consent-required` (403), `consent-version-outdated` (409), `deletion-already-scheduled` (409), `deletion-not-scheduled` (404), `legal-document-not-found` (404), `validation-failed` (400, existing).
- Validation values (shared with mobile): `displayName` trimmed 1–80 chars, no control chars; `phone` null or `^\+[1-9]\d{6,14}$`; `language` ∈ `system|ro|en`; `appearance` ∈ `system|dark|light`; `distance` ∈ `km|mi`; `currency` ∈ `RON|EUR|USD`; `reminderDays` ⊆ `{30,7,1}`; support `message` 10–4000 chars.
- Config via `application.properties` + `@ConfigMapping` (`account.*`); no hard-coded env values. Secrets only via env (`SUPABASE_SERVICE_ROLE_KEY`).
- Tests per `server/AGENTS.md` (Quarkus MCP test tool); fallback `cd server && mvn -q verify`.
- Commit after each task; message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Apple "Hide My Email" relay addresses, or a JWT with no `email` claim → `/me` must still succeed (email nullable in profile). (Task 4)
- Apple returns the user's name only on the very first sign-in → `displayName` may be null until the client PATCHes it. (Task 4)
- Two simultaneous first `/me` calls (app start + gate) → exactly one profile row, no 500. (Task 4)
- Terms version bumped between the gate check and the accept call → `409 consent-version-outdated`, not silent acceptance of the wrong version. (Task 7)
- Purge job fails after DB purge but before Supabase user delete (or reverse) → rerun must be idempotent and finish the job. (Task 8)
- A user with a scheduled deletion signs in again → still works, `/me.deletion` is populated, no data touched until `scheduledFor`. (Task 8)
- Phone typed with spaces/dashes → rejected with `validation-failed` (client normalises; server does not guess). (Task 4)

## File Structure

Server (`server/src/main/java/com/vehiclepassport/server/account/`):
- `domain/model/Profile.java` — profile aggregate (id, email?, displayName?, phone?, createdAt, deletionScheduledFor?)
- `domain/model/DisplayName.java`, `PhoneNumber.java` — validated value objects
- `domain/model/Settings.java` (+ `Language`, `Appearance`, `DistanceUnit`, `Currency`, `NotificationPrefs`) — settings model
- `domain/model/LegalDocumentType.java`, `LegalDocument.java` — legal text model
- `domain/model/ConsentType.java`, `ConsentRecord.java`, `ConsentStatus.java` — consent model + "is current accepted" rule
- `domain/exception/*` — `ConsentRequiredException`, `ConsentVersionOutdatedException`, `DeletionAlreadyScheduledException`, `DeletionNotScheduledException`, `LegalDocumentNotFoundException`
- `application/port/in/*UseCase.java` — `GetMeUseCase`, `UpdateProfileUseCase`, `GetSettingsUseCase`, `UpdateSettingsUseCase`, `GetLegalDocumentUseCase`, `ListLegalDocumentsUseCase`, `GetConsentStatusUseCase`, `RecordConsentUseCase`, `ListConsentHistoryUseCase`, `ScheduleDeletionUseCase`, `CancelDeletionUseCase`, `ExportMyDataUseCase`, `CreateSupportReportUseCase`, `CheckConsentUseCase`
- `application/port/out/*Port.java` — `ProfilePort`, `SettingsPort`, `LegalDocumentPort`, `ConsentPort`, `SupportReportPort`, `IdentityAdminPort`, `OwnerStatsPort`, `OwnerDataEraserPort`
- `application/service/*Service.java` — one per use case group, plus `AccountPurgeService`
- `api/{MeResource,SettingsResource,ConsentResource,DeletionResource,LegalResource,SupportResource}.java`, `api/dto/*`, `api/mapper/*`, `api/ConsentGateFilter.java`
- `infrastructure/persistence/{entity,repository}/*` — Panache adapters
- `infrastructure/client/SupabaseAdminClient.java` — implements `IdentityAdminPort` (delete auth user)
- `infrastructure/scheduler/AccountPurgeJob.java` — daily trigger
- `infrastructure/adapter/OwnerStatsAdapter.java`, `OwnerDataEraserAdapter.java` — call other features' `port/in`
- Modified: `vehicle|event|passport/application/port/in` — add `CountOwnedByOwnerUseCase`, `DetachOwnerUseCase` (+ passport `RevokeAllForOwnerUseCase`)

Other: `server/src/main/resources/db/migration/V7__account.sql`, `V8__legal_seed.sql`; `contracts/openapi.yaml`; `infra/supabase/config.toml`, `infra/SUPABASE-LOCAL.md`; tests under `src/test/java/.../account/**`, `src/integration-test/java/.../account/**`, `src/integration-test/resources/features/account/*.feature`.

---

### Task 1: Contract

**Files:**
- Modify: `contracts/openapi.yaml`
- Test: `server/src/integration-test/java/com/vehiclepassport/server/shared/ContractConformanceIT.java` (existing, must stay green)

**Interfaces:**
- Produces (the single source the mobile plan generates from). Tags `account`, `legal`, `support`. Operations:
  - `GET /public/legal/documents?locale=` → `LegalDocumentsResponse{documents: LegalDocumentSummary[]}`; `LegalDocumentSummary{type, version, locale, title, effectiveDate}`
  - `GET /public/legal/documents/{type}?locale=` → `LegalDocument{type, version, locale, title, bodyMarkdown, effectiveDate}`; 404 `legal-document-not-found`. `type` ∈ `terms|privacy|data-sharing`; `locale` ∈ `ro|en`, falls back to `en`.
  - `GET /me` → `MeResponse{id, email|null, emailVerified, displayName|null, phone|null, createdAt, stats{vehicles, events, passports}, deletion{scheduledFor}|null, consent: ConsentStatus}`
  - `PATCH /me` body `ProfilePatch{displayName?, phone? (nullable)}` → `MeResponse`
  - `GET /me/settings`, `PUT /me/settings` ↔ `SettingsDto{language, appearance, units{distance, currency}, notifications{documentDeadlines, reminderDays[], activityScans, activityPassportViews, activityTransfers, productNews}}`
  - `GET /me/consents` → `ConsentStatus{required: bool, terms{currentVersion, acceptedVersion|null}, privacy{currentVersion, acceptedVersion|null}, marketing: bool, analytics: bool}`
  - `POST /me/consents` body `ConsentUpdate{accept?: [{type: terms|privacy, version}], marketing?, analytics?, source: sign-up-form|social-sign-up|re-consent|settings}` → `ConsentStatus`; 409 `consent-version-outdated`
  - `GET /me/consents/history` → `ConsentHistoryResponse{items: ConsentEvent[]}`; `ConsentEvent{type, version|null, granted, source, at}`
  - `POST /me/deletion` → `DeletionStatus{scheduledFor}` (201); 409 `deletion-already-scheduled`. `DELETE /me/deletion` → 204; 404 `deletion-not-scheduled`
  - `GET /me/export` → `application/json` `AccountExport`, `Content-Disposition: attachment`
  - `POST /support/reports` body `SupportReportRequest{kind: problem|question, message, includeDiagnostics, diagnostics?{appVersion, platform, osVersion, deviceModel}}` → 201 `{id}`
  - Every non-`/public`, non-`/me*`, non-`/support` operation documents `403 consent-required` via a reusable `ConsentRequired` response.

- [ ] **Step 1:** Add the schemas/paths/parameters/responses above, with the validation values from Global Constraints as `pattern`/`minLength`/`maxLength`/`enum`.
- [ ] **Step 2:** Run `ContractConformanceIT` and `cd mobile && npm run gen:api && npm run check:contract` → expect FAIL only where the server doesn't implement the new paths yet (conformance) and PASS for generation.
- [ ] **Step 3:** Mark the new operations as expected-unimplemented in conformance until Tasks 4–10 land (remove the exemption in Task 11).
- [ ] **Step 4:** Commit `feat(contracts): account, consents, legal and support endpoints`.

### Task 2: Migrations

**Files:**
- Create: `server/src/main/resources/db/migration/V7__account.sql`, `V8__legal_seed.sql`
- Test: `server/src/integration-test/java/com/vehiclepassport/server/account/AccountMigrationIT.java`

**Interfaces:**
- Produces tables in schema `vehicle_passport`: `user_profile(id uuid pk, email text null, display_name text null, phone text null, created_at timestamptz, deletion_scheduled_for timestamptz null)`; `user_settings(user_id uuid pk, language, appearance, distance_unit, currency, notif_document_deadlines bool, notif_reminder_days smallint[], notif_scans bool, notif_passport_views bool, notif_transfers bool, notif_product_news bool default false)`; `legal_document(type, locale, version, title, body_markdown, effective_date, is_current bool, pk(type, locale, version))` with a partial unique index on `(type, locale) where is_current`; `consent_record(id uuid pk, user_id uuid null, subject_hash text null, type, version null, granted bool, source, created_at)` append-only; `support_report(id uuid pk, user_id uuid null, kind, message, diagnostics jsonb null, created_at)`. CHECK constraints mirror the enums in Global Constraints.

- [ ] **Step 1:** Write `AccountMigrationIT` asserting: tables exist; inserting `phone='0712'` violates the phone CHECK; two `is_current` rows for the same `(type, locale)` fail; V8 seeds `terms`, `privacy`, `data-sharing` in `ro` and `en`, version `1.0`, exactly one current each.
- [ ] **Step 2:** Run it → FAIL (tables missing).
- [ ] **Step 3:** Write V7 (DDL + CHECKs) and V8 (seed, body marked `PLACEHOLDER — legal review required`).
- [ ] **Step 4:** Run `AccountMigrationIT` and the full suite → PASS.
- [ ] **Step 5:** Commit `feat(server): account schema and legal seed`.

### Task 3: Domain model

**Files:**
- Create: domain classes listed in File Structure
- Test: `server/src/test/java/com/vehiclepassport/server/account/domain/*Test.java`; extend `ArchitectureTest` to cover `account`

**Interfaces:**
- Produces: `DisplayName.of(String)` (trims, throws `ValidationFailedException` outside 1–80 or on control chars); `PhoneNumber.of(String)` (E.164 only); `Settings.defaults()`; `NotificationPrefs` rejects `reminderDays` outside `{30,7,1}`; `ConsentStatus.of(currentTerms, currentPrivacy, lastAcceptedTerms, lastAcceptedPrivacy, marketing, analytics)` with `required()` true iff either accepted version ≠ current.

- [ ] **Step 1:** Write tests: `displayNameRejectsBlankAndControlChars`, `displayNameTrims`, `phoneRejectsSpacesAndDashes`, `phoneAcceptsE164`, `reminderDaysRejectUnknownValue`, `consentRequiredWhenAcceptedVersionIsOlder`, `consentNotRequiredWhenBothCurrent`, `productNewsDefaultsOff`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement per signatures (no framework imports). **Step 4:** Run unit tests + `ArchitectureTest` → PASS.
- [ ] **Step 5:** Commit `feat(account): domain model`.

### Task 4: Profile (`/me`) with lazy provisioning and stats

**Files:**
- Create: `GetMeUseCase`, `UpdateProfileUseCase`, `AccountProfileService`, `ProfilePort`, `OwnerStatsPort`, `OwnerStatsAdapter`, `MeResource`, DTOs/mappers, `ProfileEntity`, `ProfileRepository`
- Modify: `vehicle|event|passport` `port/in` → add `CountOwnedByOwnerUseCase.count(UUID ownerId): long` and implement
- Test: unit `AccountProfileServiceTest`; IT `MeResourceIT`; Cucumber `account/profile.feature`

**Interfaces:**
- Consumes: `CurrentUser.id()`, JWT `email` claim (nullable) and `email_verified`.
- Produces: `GetMeUseCase.get(UUID userId, String emailClaim, boolean emailVerified): Me`; `UpdateProfileUseCase.update(UUID userId, ProfileChange c): Me` where `ProfileChange(Optional<String> displayName, Optional<String> phone /*empty string clears*/)`; `ProfilePort.upsertIfAbsent(Profile): Profile` (INSERT … ON CONFLICT DO NOTHING).

- [ ] **Step 1:** Tests: `firstMeCallCreatesProfile`, `secondCallReturnsSameRow`, `concurrentFirstCallsCreateOneRow` (two threads), `meWorksWithoutEmailClaim`, `patchSetsDisplayName`, `patchClearsPhoneWithNull`, `patchRejectsPhoneWithSpaces` (400 `validation-failed`), `patchRejectsNameOver80`, `statsCountOnlyOwnRecords`, `meRequiresAuth` (401).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; `OwnerStatsAdapter` only calls the three `CountOwnedByOwnerUseCase`s. Email is refreshed from the claim when it differs. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(account): GET/PATCH /me`.

### Task 5: Settings

**Files:**
- Create: `GetSettingsUseCase`, `UpdateSettingsUseCase`, `SettingsService`, `SettingsPort`, `SettingsResource`, entity/repository
- Test: `SettingsServiceTest`, `SettingsResourceIT`

**Interfaces:**
- Produces: `GetSettingsUseCase.get(UUID): Settings` (returns `Settings.defaults()` when no row, without writing); `UpdateSettingsUseCase.replace(UUID, Settings): Settings`.

- [ ] **Step 1:** Tests: `getReturnsDefaultsForNewUser`, `putPersistsAndGetReturnsSame`, `putRejectsUnknownLanguage`, `putRejectsReminderDays_[14]`, `putRejectsUnknownFieldsInBody` (fail-on-unknown-properties), `settingsAreIsolatedPerUser`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (upsert). **Step 4:** Run → PASS. **Step 5:** Commit `feat(account): settings`.

### Task 6: Legal documents (public)

**Files:**
- Create: `ListLegalDocumentsUseCase`, `GetLegalDocumentUseCase`, `LegalService`, `LegalDocumentPort`, `LegalResource` (under `/public/legal`), entity/repository
- Test: `LegalServiceTest`, `LegalResourceIT`

**Interfaces:**
- Produces: `GetLegalDocumentUseCase.get(LegalDocumentType, String locale): LegalDocument` (current version; unsupported/missing locale → `en`); `LegalDocumentPort.currentVersion(LegalDocumentType): String` (used by Task 7).

- [ ] **Step 1:** Tests: `listReturnsCurrentVersionsOnly`, `getReturnsRomanianWhenRequested`, `getFallsBackToEnglishForUnknownLocale`, `getUnknownTypeIs404` (`legal-document-not-found`), `publicEndpointsNeedNoToken`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(account): public legal documents`.

### Task 7: Consents + consent gate

**Files:**
- Create: `GetConsentStatusUseCase`, `RecordConsentUseCase`, `ListConsentHistoryUseCase`, `CheckConsentUseCase`, `ConsentService`, `ConsentPort`, `ConsentResource`, `ConsentGateFilter`, entity/repository
- Modify: `application.properties` (`account.consent.enforce=true`, `%test.account.consent.enforce=false`)
- Test: `ConsentServiceTest`, `ConsentResourceIT`, `ConsentGateIT`, Cucumber `account/consent.feature`

**Interfaces:**
- Produces: `RecordConsentUseCase.record(UUID, ConsentUpdate): ConsentStatus` (appends one `consent_record` per accepted type and per changed toggle; marketing/analytics default off); `CheckConsentUseCase.isCurrent(UUID): boolean`; `ConsentGateFilter` (`@Provider`, runs after auth) returns `403 consent-required` for every path except `/public/*`, `/me`, `/me/**`, `/support/**`, `/q/**`.

- [ ] **Step 1:** Tests: `newUserIsConsentRequired`, `acceptingCurrentVersionsClearsRequired`, `acceptingOldVersionIs409ConsentVersionOutdated`, `historyIsAppendOnlyAndOrdered`, `togglingMarketingOffRecordsGrantedFalse`, `gateBlocksVehiclesUntilAccepted` (403 `consent-required`), `gateAllowsMeAndPublic`, `gateDisabledWhenConfigOff`, `bumpingTermsVersionRequiresReconsent`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; version check against `LegalDocumentPort.currentVersion`. **Step 4:** Run the **full** suite (gate must not break existing ITs; enable it explicitly only in `ConsentGateIT` via a test profile) → PASS.
- [ ] **Step 5:** Commit `feat(account): consents and consent gate`.

### Task 8: Account deletion and purge

**Files:**
- Create: `ScheduleDeletionUseCase`, `CancelDeletionUseCase`, `AccountDeletionService`, `AccountPurgeService`, `IdentityAdminPort`, `SupabaseAdminClient`, `OwnerDataEraserPort`, `OwnerDataEraserAdapter`, `DeletionResource`, `AccountPurgeJob`
- Modify: `vehicle|event|passport` `port/in` → add `DetachOwnerUseCase.detach(UUID ownerId)` (vehicle/event: replace owner reference with a tombstone UUID, keep technical history by VIN); passport `RevokeAllForOwnerUseCase.revokeAll(UUID)`
- Modify: `application.properties` → `account.deletion.grace-days=30`, `account.purge.cron`, `supabase.admin.url`, `supabase.admin.service-role-key=${SUPABASE_SERVICE_ROLE_KEY:}`
- Test: `AccountDeletionServiceTest`, `AccountPurgeServiceTest`, `DeletionResourceIT`, Cucumber `account/deletion.feature`

**Interfaces:**
- Produces: `ScheduleDeletionUseCase.schedule(UUID): Instant` (= now + grace); `CancelDeletionUseCase.cancel(UUID)`; `AccountPurgeService.purgeDue(Instant now): int`; `IdentityAdminPort.deleteUser(UUID)` (404 from Supabase counts as success).
- Purge order: revoke passports → detach owner data → anonymise consents (`user_id`→null, `subject_hash`=sha256(id)) → null `support_report.user_id` → delete settings + profile → `IdentityAdminPort.deleteUser`. Each step idempotent; profile row deleted last-but-one so a retry still finds the job.

- [ ] **Step 1:** Tests: `scheduleSetsDateThirtyDaysAhead` (TestClock), `scheduleTwiceIs409`, `cancelClearsSchedule`, `cancelWithoutScheduleIs404`, `purgeIgnoresNotYetDue`, `purgeRemovesProfileSettingsAndKeepsVehicleHistory`, `purgeAnonymisesConsentHistory`, `purgeRevokesActivePassports`, `purgeIsIdempotentAfterIdentityDeleteFailure`, `signedInUserWithScheduleStillGetsMe` (deletion populated).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; job logs counts only, never ids or emails. **Step 4:** PASS. **Step 5:** Commit `feat(account): scheduled account deletion and purge`.

### Task 9: Data export

**Files:**
- Create: `ExportMyDataUseCase`, `AccountExportService`, export DTO/mapper, endpoint in `MeResource` (`GET /me/export`)
- Test: `AccountExportServiceTest`, `ExportIT`

**Interfaces:**
- Produces: `ExportMyDataUseCase.export(UUID): AccountExport` = profile + settings + consent history + the caller's vehicles, events and passports, obtained **only** through existing/added `port/in` use cases (list-my-vehicles, timeline, list-my-passports).

- [ ] **Step 1:** Tests: `exportContainsOnlyCallersData`, `exportHasAttachmentDispositionHeader`, `exportWorksForUserWithNoVehicles`, `exportExcludesOtherUsersConsents`.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS. **Step 5:** Commit `feat(account): data export`.

### Task 10: Support reports

**Files:**
- Create: `CreateSupportReportUseCase`, `SupportService`, `SupportReportPort`, `SupportResource`, entity/repository
- Test: `SupportServiceTest`, `SupportResourceIT`

**Interfaces:**
- Produces: `CreateSupportReportUseCase.create(UUID, SupportReport): UUID`. `diagnostics` stored only when `includeDiagnostics=true`.

- [ ] **Step 1:** Tests: `createsReportAndReturns201WithId`, `messageUnder10CharsIs400`, `messageOver4000Is400`, `diagnosticsDroppedWhenFlagFalse`, `worksWhileConsentRequired` (support is exempt from the gate).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(account): support reports`.

### Task 11: Supabase providers, end-to-end sync

**Files:**
- Modify: `infra/supabase/config.toml` (enable `[auth.external.apple]`, `[auth.external.google]` with `skip_nonce_check` false, client ids/secrets from env, `additional_redirect_urls` incl. `vehiclepassport://`), `infra/SUPABASE-LOCAL.md` (how to get Apple Services ID / Google client IDs, env vars), `.env.example` entries
- Modify: `ContractConformanceIT` (remove Task 1 exemption)
- Test: `server/src/integration-test/java/.../account/AccountJourneyIT.java`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1:** Write `AccountJourneyIT` (one scenario): new token → `/vehicles` 403 `consent-required` → `GET /public/legal/documents` → `POST /me/consents` accept current → `/vehicles` 200 → `PATCH /me` → `PUT /me/settings` → `POST /me/deletion` → `GET /me` shows date → `DELETE /me/deletion`.
- [ ] **Step 2:** Run → PASS (all prior tasks). Run `ContractConformanceIT` with the exemption removed → PASS.
- [ ] **Step 3:** Document in `SUPABASE-LOCAL.md` that Apple/Google require real credentials and cannot be exercised in CI.
- [ ] **Step 4:** Run full `mvn -q verify` → PASS. Commit `feat(infra): enable Apple and Google providers; account journey IT`.

---

## Self-Review

- **Coverage:** profile/edit → T4; settings (notifications, language, appearance, units/currency) → T5; Terms/Privacy pages + versions in DB → T2/T6; consents persisted + re-consent gate → T7; delete account (30 days, keeps history) → T8; download my data → T9; support → T10; Apple/Google → T11 (+ mobile). Sign-in methods, password change, biometrics, sign-out-others deliberately client-side (Decisions).
- **Gap vs. artifact:** Facebook removed; passkeys and "Acknowledgements" licence report are mobile-only/out of scope; push delivery of notifications is out of scope (only preferences persisted).
- **Types:** `ConsentStatus`, `MeResponse`, `SettingsDto` names are fixed in Task 1 and reused verbatim by the mobile plan.
- **Known red window:** between Task 1 and Task 4–10 the conformance IT is exempted; the consent gate is off in `%test` so existing ITs stay green until Task 7 enables it only for its own IT.
