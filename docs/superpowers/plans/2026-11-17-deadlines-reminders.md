# Deadlines & Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the state of the six car documents (green / yellow / red / grey) and remind the owner on the phone, with local notifications, 30 / 7 / 1 days before expiry and on the expiry day, plus tire-season reminders.

**Architecture:** The server computes document status in a new endpoint (`event` feature, pure domain function) and gains one settings flag (`tireSeason`). The phone builds a pure *reminder plan* from that status, then cancels all its notifications and schedules the plan again (`expo-notifications`) on every trigger. A renewed document therefore never keeps its old reminder.

**Tech Stack:** Quarkus + Flyway + Cucumber + ArchUnit (server); Expo, expo-router, TanStack Query, openapi-fetch, jest + jest-cucumber, new dependency `expo-notifications` (mobile).

**Spec:** `docs/superpowers/specs/2026-11-16-deadlines-reminders-design.md` (data, endpoint, plan) and `docs/superpowers/specs/2026-11-16-deadlines-reminders-mobile-design.md` (screens). Both approved 2026-11-17, including the expiry-day reminder (§3.7).

## Global Constraints

- Contract first: `contracts/openapi.yaml` changes in Task 1, then `npm run gen:api` in `mobile/`.
- Hexagonal rules (`.claude/rules/backend-architecture.md`): `domain` is pure Java; `@Transactional` only in `application/service`; `DeadlinesService` stays in `event` and reads only `EventRepositoryPort.validityEntries(vin)` (no new query).
- Six document kinds, fixed response order: `ITP, RCA, CASCO, ROVINIETA, FIRE_EXTINGUISHER, FIRST_AID_KIT`. `CASCO` is the only optional one.
- Status values: `VALID | EXPIRING | EXPIRED | UNKNOWN | NOT_RECORDED`. EXPIRING threshold: 30 days (`ValidityStatusPolicy.EXPIRING_DAYS`, reuse, do not duplicate). `daysLeft` = `validUntil − today`, negative when expired, null without a date.
- Every missing document is `NOT_RECORDED` (grey), never red.
- Reminders: local only, fire at **09:00 local** on `validUntil − d` for each `d` in the user's `reminderDays` **plus `0` (expiry day, always, same master switch `documentDeadlines`)**, only if that moment is still in the future. Nothing after expiry. Only documents with status `VALID` or `EXPIRING` and a `validUntil` get reminders.
- Tire season: next **15 October** (winter tires) and next **1 April** (summer tires) after now, per car, 09:00 local, skipped when the car has a `TIRES` event dated within the 30 days before that reminder date. Switch: `notifications.tireSeason`, default `true`.
- iOS keeps at most 64 pending local notifications: the plan takes the **earliest 60** by fire time over all cars.
- Permission is never asked at first launch. A short explanation (`ConfirmSheet`: "Allow reminders" / "Not now") comes before the system prompt, the first time a reminder would be scheduled.
- Notification data payload `{ vin, kind }`; tap opens `/vehicles/{vin}/deadlines`. Android channel id `deadlines`, default importance.
- Copy lives in `mobile/src/shared/i18n/en.ts` (the only strings file that is complete); Romanian is left to when `ro` strings are filled.
- Applied Flyway migrations are never edited; the next free number is `V12`.
- `mobile/test/operations-covered.test.ts` requires every authenticated contract operation to be called by a feature: `getDeadlines` is consumed in Task 8.

## Review Focus

- Signing out (or deleting the account) leaves reminders for the previous user on the phone → expected: all scheduled notifications are cancelled on sign-out (Task 10).
- A car released or transferred away still reminds → expected: the rebuilt plan only contains cars currently in the garage (Task 10).
- Document renewed in the app after the expiry-day reminder was scheduled → expected: that reminder is gone after the event is saved (Tasks 7, 10).
- Expiry date is today and it is already past 09:00 → expected: no notification scheduled, and no crash from a past trigger (Task 7).
- Permission denied or never answered → expected: nothing scheduled, no repeated prompt, a note and "Open system settings" on the notifications screen (Tasks 9, 13).
- Month-end and leap-day dates (`validUntil` = 29 Feb, 31 Dec) and the day-of-week/DST shift of 09:00 → expected: reminder fires on the right calendar date at 09:00 local (Task 7).

---

## Part A: Contract and backend

### Task 1: Contract

**Files:**
- Modify: `contracts/openapi.yaml` (new path next to `/vehicles/{vin}/timeline/summary`, line ~528; `SettingsDto.notifications` at ~1797)
- Regenerate: `mobile/src/shared/api/generated/schema.d.ts`

**Interfaces:**
- Produces: operation `getDeadlines` (`GET /vehicles/{vin}/deadlines`, tag `events`, same `Vin` parameter, responses 200 / 401 / 403 consent / 404 vehicle-not-found, same `Problem` shape as the timeline summary); schemas `DeadlinesResponse { items: DeadlineItem[] }`, `DeadlineItem { kind: DocumentKind, status: DeadlineStatus, validUntil: date|null, daysLeft: integer|null, eventId: uuid|null }`, enums `DocumentKind`, `DeadlineStatus`; `notifications.tireSeason: boolean` (required in the response; on `PUT` an omitted value keeps the stored one, like the other flags: check how they behave and match).

- [ ] **Step 1:** Add the path, schemas and `tireSeason` to the contract, with the six `DocumentKind` values in the fixed order and `items` documented as always six.
- [ ] **Step 2:** Run `npm run gen:api` in `mobile/`, then `npm run typecheck`. Expected: typecheck fails only where `Settings['notifications']` is constructed without `tireSeason` (`mobile/test/fake-api/account.ts:37`); fix by adding `tireSeason: true` there.
- [ ] **Step 3:** Commit `feat(contract): deadlines endpoint and tireSeason setting`.

### Task 2: Domain status function

**Files:**
- Create: `server/src/main/java/com/vehiclepassport/server/event/domain/model/DocumentKind.java`, `DeadlineStatus.java`, `DocumentDeadline.java`, `DeadlinesPolicy.java`
- Test: `server/src/test/java/com/vehiclepassport/server/event/domain/model/DeadlinesPolicyTest.java`

**Interfaces:**
- Produces: `enum DocumentKind { ITP, RCA, CASCO, ROVINIETA, FIRE_EXTINGUISHER, FIRST_AID_KIT; boolean optional(); ValidityGroup group(); }` (declaration order is the response order; map to `ValidityGroup` ITP, RCA, CASCO, ROVINIETA, EXTINGUISHER, FIRST_AID); `enum DeadlineStatus { VALID, EXPIRING, EXPIRED, UNKNOWN, NOT_RECORDED }`; `record DocumentDeadline(DocumentKind kind, DeadlineStatus status, LocalDate validUntil, Integer daysLeft, UUID eventId)`; `DeadlinesPolicy.of(List<VehicleEvent> validityEntries, LocalDate today): List<DocumentDeadline>` always six items.

- [ ] **Step 1: Write failing tests** in `DeadlinesPolicyTest`: `emptyHistoryGivesSixNotRecordedInFixedOrder`; `exactly30DaysLeftIsExpiring` and `31DaysLeftIsValid`; `expiresTodayIsExpiringWithZeroDaysLeft`; `expiredYesterdayIsExpiredWithMinusOne`; `itpWithoutValidUntilIsUnknown`; `renewedRcaReplacesTheOlderOne` (newest `validFrom` wins, `eventId` is the new one); `cascoAbsentIsNotRecordedAndOptional`; `legacyInsuranceWithoutDetailsBelongsToNoGroup`. Build `VehicleEvent`s the way `ValidityStatusPolicy`'s existing tests do.
- [ ] **Step 2:** Run `mvn -pl server test -Dtest=DeadlinesPolicyTest`. Expected: FAIL (types missing).
- [ ] **Step 3:** Implement `DeadlinesPolicy.of` by reusing `ValidityStatusPolicy.currentIds`, `group` and `status` (map `SUPERSEDED` never occurs for a current entry; map the rest 1:1 to `DeadlineStatus`), using `EXPIRING_DAYS` from that class. No duplicated thresholds.
- [ ] **Step 4:** Run the test class. Expected: PASS.
- [ ] **Step 5:** Commit `feat(event): document deadlines policy`.

### Task 3: Endpoint

**Files:**
- Create: `event/application/port/in/DeadlinesUseCase.java`, `DeadlinesView.java`, `DeadlineItemView.java` (strings and JDK types only, ArchUnit rule 5); `event/application/service/DeadlinesService.java`; `event/api/DeadlinesResource.java` (path `/vehicles/{vin}/deadlines`); `event/api/dto/DeadlinesResponse.java`, `DeadlineItemDto.java`; method on `EventDtoMapper` (or a new `DeadlinesDtoMapper`).
- Test: `server/src/integration-test/resources/features/event/deadlines.feature` + steps (next to `timeline_extended.feature`); `DeadlinesServiceTest` with a fixed `Clock`.

**Interfaces:**
- Consumes: `DeadlinesPolicy.of`, `EventRepositoryPort.validityEntries(vin)`.
- Produces: `DeadlinesUseCase.get(UUID userId, String vin): DeadlinesView`; same access, consent and 404 rules as `GetTimelineSummaryUseCase`: copy its checks, do not invent new ones. "Today" uses the same `Clock` and rule as `EventService.rating`.

- [ ] **Step 1: Write the feature** scenarios: empty car returns six `NOT_RECORDED` in order; renewed RCA replaces the old one; CASCO absent is `NOT_RECORDED`; expired ITP is `EXPIRED` with negative `daysLeft`; 403 without consent; 404 for an unknown vehicle; response matches the contract (`ContractConformanceIT`).
- [ ] **Step 2:** Run `mvn -pl server verify -Dit.test=...deadlines...`. Expected: FAIL (404 route).
- [ ] **Step 3:** Implement service, resource, DTO and mapper. Resource is thin; `DeadlinesService` is `@ApplicationScoped`, no `@Transactional` needed beyond what the timeline summary service does (mirror it).
- [ ] **Step 4:** Run the integration tests and the ArchUnit suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat(event): GET /vehicles/{vin}/deadlines`.

### Task 4: `tireSeason` setting

**Files:**
- Create: `server/src/main/resources/db/migration/V12__notification_tire_season.sql`
- Modify: `account/domain/model/NotificationPrefs.java` (add `boolean tireSeason`; `defaults()` returns `true`), `account/infrastructure/persistence/repository/SettingsRepository.java` (select and upsert column `notif_tire_season`), `account/api/dto/SettingsDto.java`, `account/api/mapper/SettingsDtoMapper.java`, `account/infrastructure/adapter/OwnerDataExportAdapter.java`
- Test: `SettingsTest.java`, `SettingsResourceIT.java`, `AccountMigrationIT.java`

**Interfaces:**
- Produces: `NotificationPrefs(documentDeadlines, reminderDays, tireSeason, activityScans, activityPassportViews, activityTransfers, productNews)` (position after `reminderDays` to match the contract order; update every constructor call, including tests).

- [ ] **Step 1: Write failing tests:** `tireSeason round-trips through PUT/GET /me/settings`; `defaults() has tireSeason true`; `existing rows migrate to true` (`AccountMigrationIT`); `PUT without tireSeason keeps the stored value` if that is how the other flags behave; export contains the field.
- [ ] **Step 2:** Run the three test classes. Expected: FAIL.
- [ ] **Step 3:** Migration `alter table vehicle_passport.user_settings add column notif_tire_season boolean not null default true;`. Update the repository SQL, DTO, mapper and export adapter.
- [ ] **Step 4:** Run `mvn -pl server verify`. Expected: PASS, including ArchUnit and `ContractConformanceIT`.
- [ ] **Step 5:** Commit `feat(account): tire season notification setting`.

---

## Part B: Mobile

Run `npm run check` in `mobile/` at the end of every task that says so; it is `typecheck && lint && check:contract && check:licenses && test`.

### Task 5: Design additions and dependency

**Files:**
- Modify: `mobile/package.json` (run `npx expo install expo-notifications`), `mobile/app.json` (add `expo-notifications` plugin), `mobile/src/shared/design/primitives/Icon.tsx` (add `bell` to `SHAPES`: `{ d: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z' }` and `{ d: 'M10 20.5a2 2 0 0 0 4 0' }`), `mobile/src/shared/design/index.ts`, `mobile/test/fakes/nativeModules.ts` (mock `expo-notifications` and `expo-linking`'s `openSettings` if needed), licence list via `npm run gen:licenses`
- Create: `mobile/src/shared/design/primitives/StatusPill.tsx`, `CountBadge.tsx`
- Test: `mobile/src/shared/design/primitives.test.tsx` (extend: `iconNames` includes `bell`)

**Interfaces:**
- Produces: `StatusPill({ tone: 'ok'|'warn'|'bad'|'muted'; label: string; icon?: IconName; dashed?: boolean })` (tone → tokens `brand` / `warning` / `danger` / `evidence-estimated`; look rules of `EvidenceBadge`); `CountBadge({ count: number; tone: 'warn'|'bad' })` (renders nothing at 0, shows `9+` above 9, min 18×18, `radius-pill`).

- [ ] **Step 1: Write failing tests:** `StatusPill maps each tone to its colour token in light and dark`; `StatusPill dashed draws a dashed border`; `CountBadge renders null at 0`; `CountBadge shows 9+ for 10`; `CountBadge tone bad uses danger colour`; icon bundle contains `bell`.
- [ ] **Step 2:** Run `npx jest src/shared/design`. Expected: FAIL.
- [ ] **Step 3:** Implement the primitives and the icon; export from `shared/design/index.ts`. Check the bell next to `shield`/`alert` at 24 px and tweak the path if it looks off (builder's call).
- [ ] **Step 4:** Run `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(design): bell icon, StatusPill, CountBadge; add expo-notifications`.

### Task 6: Strings and document registry

**Files:**
- Modify: `mobile/src/shared/i18n/en.ts` (add `deadlines.*`: screen title "Document status", status words, row second-line copy, `notification` title/body builders, footer lines "Reminders: …, and on the expiry day" / "Reminders are off", and `settings.notifications.tireSeason`, its caption "Winter tires on 15 October, summer tires on 1 April", the permission sheet and denied-note copy)
- Create: `mobile/src/features/deadlines/model/documentRegistry.ts`
- Test: `mobile/src/features/deadlines/model/documentRegistry.test.ts`

**Interfaces:**
- Produces: `type DocumentKind = components['schemas']['DocumentKind']`; `DOCUMENT_ORDER: readonly DocumentKind[]`; `DOCUMENT_CONFIG: Record<DocumentKind, { label: string; icon: IconName; optional: boolean; preset: { type: EventType; coverage?: 'RCA'|'CASCO'; item?: 'FIRE_EXTINGUISHER'|'FIRST_AID_KIT' } }>` (icons: ITP `car`, RCA `shield`, CASCO `shield`, ROVINIETA `doc`, FIRE_EXTINGUISHER `alert`, FIRST_AID_KIT `plus`); `en.deadlines.notification.title(kind: DocumentKind, daysLeft: number): string` ("RCA expires in 7 days", "… in 1 day", "… today"), `body(carName: string): string` ("{car name}. Open to review."), `tireTitle(season: 'winter'|'summer'): string`, `tireBody(carName: string): string`.

- [ ] **Step 1: Write failing tests:** `every contract DocumentKind has a config entry` (compare with `DOCUMENT_ORDER`); `only CASCO is optional`; `presets match the event type registry` (`EVENT_TYPE_CONFIG` has each preset type); notification title for 7, 1 and 0 days.
- [ ] **Step 2:** Run `npx jest src/features/deadlines`. Expected: FAIL.
- [ ] **Step 3:** Implement. Pluralise "day/days" in one helper.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): strings and document registry`.

### Task 7: Reminder plan (pure)

**Files:**
- Create: `mobile/src/features/deadlines/model/reminderPlan.ts`
- Test: `mobile/src/features/deadlines/model/reminderPlan.test.ts`

**Interfaces:**
- Consumes: `DOCUMENT_CONFIG`, `en.deadlines.notification`.
- Produces:

```ts
export type PlannedReminder = {
  fireAt: Date;                       // 09:00 local
  title: string;
  body: string;
  data: { vin: string; kind: DocumentKind | 'TIRE_WINTER' | 'TIRE_SUMMER' };
};
export type PlanCar = { vin: string; carName: string; items: DeadlineItem[]; lastTiresOn: string | null };
export type PlanPrefs = { documentDeadlines: boolean; reminderDays: number[]; tireSeason: boolean };
export const REMINDER_CAP = 60;
export function reminderPlan(cars: PlanCar[], prefs: PlanPrefs, now: Date): PlannedReminder[];
```

Output is sorted by `fireAt` ascending. The plan decides the tire-season rule (`lastTiresOn` within the 30 days up to and including the reminder date means skip).

- [ ] **Step 1: Write failing tests** (fixed `now`, fixed offset-free local dates): `valid RCA gives reminders at 30, 7, 1 days and on the expiry day at 09:00`; `reminder days that are not enabled are left out but the expiry day stays`; `a reminder moment already past is dropped` (including expiry today after 09:00); `EXPIRED, UNKNOWN and NOT_RECORDED give nothing`; `documentDeadlines off gives no document reminders`; `renewed document: new validUntil gives no reminder for the old date` (feed items before and after, assert the old fire time is absent); `tire season: next 15 Oct and next 1 Apr, per car`; `tire season skipped when lastTiresOn is within 30 days before the reminder date, kept when 31 days before`; `tireSeason off gives no tire reminders`; `cap: 3 cars with many reminders gives the earliest 60`; `29 Feb and 31 Dec validUntil land on the right date`; `title and body use the car name`.
- [ ] **Step 2:** Run `npx jest src/features/deadlines/model/reminderPlan`. Expected: FAIL.
- [ ] **Step 3:** Implement `reminderPlan` with local-date construction (`new Date(y, m, d, 9, 0, 0)`; never add 24 h multiples, so DST cannot shift the day). Parse `validUntil` ISO with the same parser as `features/event/model/validity.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): reminder plan`.

### Task 8: Data hooks and fake API

**Files:**
- Create: `mobile/src/features/deadlines/api/useDeadlines.ts`, `mobile/src/features/deadlines/index.ts`
- Modify: `mobile/src/shared/api/queryKeys.ts` (add `deadlines: (vin) => ['timeline', vin, 'deadlines'] as const`, under `timeline(vin)` so every event add / edit / delete / attachment change, which already invalidates `qk.timeline(vin)`, refreshes it, and `forgetVehicle` removes it), `mobile/test/fake-api/handlers.ts` (+ `builders.ts`: handler for `getDeadlines` computing the six items from the fake events with `daysBetween`, mirroring the server rules), `mobile/test/fake-api/fake.test.ts`
- Test: `mobile/src/features/deadlines/api/useDeadlines.test.tsx`

**Interfaces:**
- Produces: `useDeadlines(vin: string)` → `UseQueryResult<DeadlinesResponse>`, `meta: { vin }` like `useTimelineSummary`; `type DeadlineItem = components['schemas']['DeadlineItem']`.

- [ ] **Step 1: Write failing tests:** `useDeadlines returns six items for an empty car` (fake API); `adding an RCA event refreshes deadlines` (via the existing add-event mutation invalidation); fake handler boundary cases agree with the server table (30 days → EXPIRING, expiry today → EXPIRING with `daysLeft` 0, yesterday → EXPIRED).
- [ ] **Step 2:** Run `npx jest src/features/deadlines/api test/fake-api test/operations-covered`. Expected: FAIL (operation unhandled / not consumed).
- [ ] **Step 3:** Implement hook, key and fake handler.
- [ ] **Step 4:** Run `npm run check`. Expected: PASS (`operations-covered` now sees `getDeadlines`).
- [ ] **Step 5:** Commit `feat(deadlines): useDeadlines and fake API handler`.

### Task 9: Scheduler and permission

**Files:**
- Create: `mobile/src/features/deadlines/notifications/scheduler.ts`, `permission.ts`, `mobile/src/features/deadlines/components/ReminderPermissionSheet.tsx`
- Test: `scheduler.test.ts`, `permission.test.ts`, `ReminderPermissionSheet.test.tsx` (same folders)

**Interfaces:**
- Consumes: `PlannedReminder`.
- Produces:

```ts
export type NotificationsModule = Pick<typeof import('expo-notifications'),
  'cancelAllScheduledNotificationsAsync' | 'scheduleNotificationAsync' | 'setNotificationChannelAsync'>;
export async function applyPlan(plan: PlannedReminder[], mod?: NotificationsModule): Promise<void>; // cancel all, then schedule each; ensures channel `deadlines` on Android
export async function cancelAll(mod?: NotificationsModule): Promise<void>;
export type PermissionState = 'granted' | 'denied' | 'undetermined';
export async function readPermission(): Promise<PermissionState>;
export async function requestPermission(): Promise<PermissionState>;
export const reminderPrompt: { wasExplained(): Promise<boolean>; markExplained(): Promise<void> }; // AsyncStorage flag, per device
```

- [ ] **Step 1: Write failing tests** (mocked module): `applyPlan cancels before scheduling and schedules each reminder with its date trigger and data`; `applyPlan with an empty plan only cancels`; `a scheduling failure for one reminder does not stop the rest`; `cancelAll cancels`; `sheet: Allow reminders requests permission after the explanation, Not now remembers it and does not request`.
- [ ] **Step 2:** Run `npx jest src/features/deadlines/notifications`. Expected: FAIL.
- [ ] **Step 3:** Implement. Date trigger `{ type: 'date', date: fireAt, channelId: 'deadlines' }` per the installed `expo-notifications` version's `SchedulableTriggerInputTypes`; check its typings. All wrappers swallow nothing silently: log a warning on failure.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): notification scheduler and permission flow`.

### Task 10: Sync component

**Files:**
- Create: `mobile/src/features/deadlines/notifications/ReminderSync.tsx`, `tiresQuery.ts` (the latest `TIRES` event date per car: `GET /vehicles/{vin}/timeline?type=TIRES&order=desc&limit=1`, key under `['timeline', vin, 'lastTires']`)
- Modify: `mobile/app/_layout.tsx` (mount `<ReminderSync />` next to `<SettingsSync />` when signed in; on sign-out call `cancelAll`), `mobile/src/features/deadlines/index.ts`
- Test: `mobile/test/steps/deadlines.sync.test.tsx`

**Interfaces:**
- Consumes: `useVehicles`, `useDeadlines`/`useQueries` per car, `useSettings`, `reminderPlan`, `applyPlan`, `cancelAll`, `readPermission`, `reminderPrompt`.
- Produces: `ReminderSync()` renders `ReminderPermissionSheet` when a non-empty plan exists, permission is `undetermined` and the prompt has not been explained; applies the plan only when permission is `granted`, whenever the plan's content changes. The app returning to the foreground refetches the deadlines (the plan is rebuilt from fresh data). Signed-out state, consent not accepted, or `documentDeadlines` off and `tireSeason` off all result in `cancelAll`.

- [ ] **Step 1: Write failing tests** (fake API, mocked notifications module): `signing in schedules reminders for every car in the garage`; `saving a renewed RCA reschedules and the old expiry-day reminder is gone`; `releasing a car removes its reminders`; `signing out cancels all`; `denied permission schedules nothing and shows no sheet`; `undetermined permission shows the explanation sheet once, then never again after Not now`; `turning documentDeadlines off cancels`; `app returning to foreground refetches deadlines`.
- [ ] **Step 2:** Run `npx jest test/steps/deadlines.sync`. Expected: FAIL.
- [ ] **Step 3:** Implement. Compute a stable signature of the plan (JSON of fire times and titles) and apply only when it changes, so re-renders do not reschedule.
- [ ] **Step 4:** Run `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): keep scheduled reminders in sync`.

### Task 11: Notification tap

**Files:**
- Create: `mobile/src/features/deadlines/notifications/routeForNotification.ts`, `useNotificationTap.ts`
- Modify: `mobile/app/_layout.tsx` (register the hook inside `Shell`)
- Test: `routeForNotification.test.ts`, `mobile/test/steps/deadlines.tap.test.tsx`

**Interfaces:**
- Produces: `routeForNotification(data: unknown): string | null` returns `/vehicles/{vin}/deadlines` for a payload with a string `vin`, else null (never navigates on malformed data); `useNotificationTap()` handles `addNotificationResponseReceivedListener` and the cold start `getLastNotificationResponse`.

- [ ] **Step 1: Write failing tests:** `routes a valid payload`; `ignores a payload without vin or with a non-string vin`; `a tap while signed out ends on sign-in and then on the target` (check how existing deep links behave in `test/navigation.rules.test.ts` and match, builder's call); `a tap for a car no longer in the garage shows the app's normal vehicle-not-found handling`.
- [ ] **Step 2:** Run both. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): open document status from a notification`.

### Task 12: Document status screen and form presets

**Files:**
- Create: `mobile/app/vehicles/[vin]/deadlines.tsx`, `mobile/src/features/deadlines/components/DeadlinesScreen.tsx`, `DeadlineRow.tsx`, `mobile/features/deadlines.feature`, `mobile/test/steps/deadlines.steps.tsx`
- Modify: `mobile/app/vehicles/[vin]/events/new.tsx` (read `type`, `coverage`, `item` search params), `mobile/src/features/event/components/EventFormScreen.tsx` and `mobile/src/features/event/model/eventForm.ts` (optional `preset` for the new form built on `newFormInput` + `typeDefaults`; invalid or unknown params are ignored), `mobile/src/features/deadlines/index.ts`

**Interfaces:**
- Consumes: `useDeadlines`, `DOCUMENT_CONFIG`, `StatusPill`, `SettingsGroup`, `SettingsRow`, settings.
- Produces: `DeadlinesScreen({ vin: string; carName?: string })`; `EventFormScreen` accepts `preset?: { type: EventType; coverage?: 'RCA'|'CASCO'; item?: 'FIRE_EXTINGUISHER'|'FIRST_AID_KIT' }`. Status → pill mapping per mobile spec §2 (VALID ok/`check`, EXPIRING warn/`clock`, EXPIRED bad/`alert`, UNKNOWN muted dashed/`clock` "No expiry date", NOT_RECORDED muted dashed "Not added"). Second-line copy and row taps per mobile spec §2: row with `eventId` → event detail; `NOT_RECORDED`/`UNKNOWN` → `/vehicles/{vin}/events/new?type=…&coverage=…`. Footer shows the reminder days plus "and on the expiry day", or "Reminders are off", and a secondary button to `/account/notifications`. Refetch on focus (`useRefetchOnFocus`).

- [ ] **Step 1: Write the feature** `deadlines.feature` (scenarios: six rows in order for a fresh car, all "Not added"; expiring RCA shows "Expiring" and "12 days"; expired shows "expired 3 days ago"; CASCO shows "Optional · Add"; tapping "Add" on RCA opens the form with insurance and RCA preselected; tapping a recorded row opens its detail; footer with reminders on and off; skeleton, error with retry, offline) and the matching steps; add `preset` unit tests to `eventForm.test.ts` (`preset RCA preselects INSURANCE and coverage RCA`, `unknown type param is ignored`).
- [ ] **Step 2:** Run `npx jest test/steps/deadlines.steps src/features/event/model/eventForm`. Expected: FAIL.
- [ ] **Step 3:** Implement screen, row, route and preset handling.
- [ ] **Step 4:** Run `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): document status screen`.

### Task 13: Bell on the car screen

**Files:**
- Create: `mobile/src/features/deadlines/components/DeadlinesBell.tsx`
- Modify: `mobile/src/features/vehicle/components/CarHomeScreen.tsx` (the `right` slot of `Header`, around line 176: the bell goes left of the "more" button), `mobile/src/features/deadlines/index.ts`
- Test: `mobile/test/steps/deadlines.bell.test.tsx`

**Interfaces:**
- Produces: `DeadlinesBell({ vin: string })`: 48×48 `Pressable`, role button, label "Document status", value "N documents need attention" / "All documents in order"; `CountBadge` count = items `EXPIRING` or `EXPIRED`; tone `bad` if any expired else `warn`; no badge while loading or on error; tap pushes `/vehicles/{vin}/deadlines`. `CarHomeScreen` imports it from `@/features/deadlines`.

- [ ] **Step 1: Write failing tests:** `no badge while loading and on error`; `no badge when all valid or not recorded`; `warn tone for expiring only, bad tone when any is expired`; `count and accessibility value`; `tap opens the screen`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement and wire it into `CarHomeScreen`.
- [ ] **Step 4:** Run `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(deadlines): bell with count on the car screen`.

### Task 14: Notification settings

**Files:**
- Modify: `mobile/src/features/settings/components/NotificationsScreen.tsx` (a `Switch` for `tireSeason` under the Reminders group with its caption; when the OS permission is `denied`, a caption and a `Button` "Open system settings" calling `Linking.openSettings()`; turning a reminder switch on while permission is `undetermined` and not yet explained opens the explanation sheet before the system prompt), `mobile/features/settings.feature`, `mobile/test/steps/settings.steps.tsx`
- Test: scenarios in `settings.feature`

**Interfaces:**
- Consumes: `readPermission`, `requestPermission`, `reminderPrompt`, `ReminderPermissionSheet` (exported by `@/features/deadlines`).

- [ ] **Step 1: Write failing scenarios:** `Tire-season switch persists`; `With permission denied I see the note and Open system settings`; `Turning on document deadlines for the first time shows the explanation before any system prompt`.
- [ ] **Step 2:** Run `npx jest test/steps/settings`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep the switches usable when permission is denied.
- [ ] **Step 4:** Run `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(settings): tire-season switch and reminder permission note`.

### Task 15: Diagram and manual checklist

**Files:**
- Create: `docs/diagrams/deadlines-reminders.puml` (sequence: event saved → deadlines endpoint → plan → cancel/schedule → tap → screen), a "Deadlines and reminders" section in `mobile/docs/e2e-account.md`'s neighbour `mobile/docs/e2e-deadlines.md`
- Modify: `server/README.md` (endpoint and setting), `mobile/README.md` if it lists features

- [ ] **Step 1:** Write the diagram and the checklist: grant; deny; deny then grant from system settings; change the device date across a reminder and across the expiry day; renew a document and confirm the expiry-day reminder no longer fires; reinstall and sign in (reminders return after the first open); sign out (none fire).
- [ ] **Step 2:** Run `npm run check` in `mobile/` and `mvn -pl server verify`. Expected: PASS.
- [ ] **Step 3:** Commit `docs: deadlines and reminders diagram and e2e checklist`.

---

## Self-review notes

- Spec coverage: §3.7 expiry-day reminder → Task 7; §5.2 → Task 2; §5.3 → Task 7; §6 → Task 1; §7 → Tasks 2–4; mobile §1 → Tasks 5, 13; §2 → Task 12; §3 → Task 5; §4 → Task 14; §5 → Tasks 9, 11; §9–§10 → test steps and Task 15. Spec §12 questions 1 and 2 (grey for missing; 15 Oct / 1 Apr) are implemented as written; change `DOCUMENT_CONFIG` / the constants in Task 7 if the owner decides otherwise.
- Known limit, documented in the spec: a renewal recorded on another device cancels this device's reminders only after the app is opened here.
- Open choice left to the builder: `DeadlinesResource` as its own class (planned) or a method on `TimelineResource`.
