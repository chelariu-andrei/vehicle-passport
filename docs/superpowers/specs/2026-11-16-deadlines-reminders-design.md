# Deadlines & reminders (document status, local notifications, tire season)

Date: 2026-11-16 · Scope: `contracts/`, `server/` (event, account settings), `mobile/` · Status: approved by owner 2026-11-17 (with the expiry-day reminder added, §3.7)
Depends on: `2026-11-16-timeline-extended-design.md` (validity data, `validityStatus`, `validityEntries`). That
spec must be merged first.
Mobile UI (bell icon, badge, screens, components): `2026-11-16-deadlines-reminders-mobile-design.md`.

## 1. Intent

The timeline now knows what is valid until when. The owner wants the app to **say it**: one place that shows the state
of the six documents, and a nudge before one runs out, so a fine or a failed roadside check never comes as a surprise.
Tire-season reminders cover the other recurring chore.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- A **Document status** view per car: ITP, RCA, CASCO, rovinietă, fire extinguisher, first-aid kit. Each is green,
  yellow, red or grey.
- **Local** notifications (`expo-notifications`) at 30 / 7 / 1 days before expiry. The days are the user's existing
  `notifications.reminderDays`; the master switch is the existing `notifications.documentDeadlines`.
- **Tire-season** reminders, with their own switch.
- The status is computed on the server, so mobile and `web/` agree.

**Non-goals**
- Push notifications, scheduled server jobs, e-mail or SMS. Nothing is sent from the server.
- Reminders for custom (`OTHER`) events, service intervals or mileage-based maintenance.
- Per-car or per-document notification settings. One global setting, as today.
- Snooze, or "mark as done" on a reminder.
- Filtering the timeline by validity (the timeline spec deferred it; still deferred).

**Anti-goals**
- A red screen for a new user whose car has nothing recorded yet. Missing must not look like an offence.
- A reminder for a document the user has already renewed.
- Asking for notification permission at first launch, before the user has seen why.

## 3. Decisions and my calls

Decided by the owner (from the request):
- Six documents, green / yellow / red, CASCO missing is **grey**.
- Local notifications at 30 / 7 / 1 days, configurable.
- Tire-season reminders.

My calls (please correct):
1. **Every missing document is grey, not only CASCO.** The app cannot know the user owns a fire extinguisher or a valid
   RCA. Red is for "recorded and expired". Alternative: RCA, ITP and rovinietă missing → red. I rejected it because a
   fresh car would open on three red rows.
2. **Status is a new server endpoint**, not computed on the phone. The phone would have to download the whole timeline
   to find each group's current entry.
3. **Reminders are rebuilt, not patched.** On each trigger the app cancels all its deadline notifications and
   schedules the full set again from the endpoint. Simple, and it fixes edits, renewals and deletions without
   tracking ids.
4. **Fire time is 09:00 local** on the reminder day.
5. **Tire season dates are fixed**: winter tires reminder on **15 October**, summer tires on **1 April**. They suit
   Romania and need no weather data. Skipped for a car that has a `TIRES` event dated within the 30 days before the
   reminder.
6. **`tireSeason` joins `NotificationPrefs`** (server settings, default `true`), so it follows the user across devices
   like the other switches.
7. **One extra reminder on the expiry day itself (09:00 local), owner-requested.** It is always scheduled in addition
   to the user's `reminderDays`, and is skipped when the document has been renewed (see §5.3: the plan is rebuilt from
   the current entry, so a renewed document has a later `validUntil` and no expiry-day reminder). **Nothing after
   expiry**: the red row and the bell badge cover "already expired".

## 4. Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | **Server endpoint for status + local scheduling on the phone** | One small endpoint; notifications work offline once scheduled; status identical on every client | **Chosen** |
| B | Phone computes status from the full timeline | No contract change, but downloads and paginates the whole history, and duplicates the rules the server already has | Rejected |
| C | Server push (cron + FCM/APNs) | Reaches reinstalled/second devices instantly, but needs tokens, a scheduler, delivery infra, privacy review | Rejected: out of scope, local was requested |

Local-notification limits to accept: a reinstall or a new device has none until the app opens and signs in once; the
reminders are per device.

## 5. Domain

### 5.1 Document kinds

`ITP`, `RCA`, `CASCO`, `ROVINIETA`, `FIRE_EXTINGUISHER`, `FIRST_AID_KIT`. They map one-to-one to the validity groups in
timeline spec §5.6. `CASCO` is the only optional one (flag `optional: true`, used for display copy, not for colour).

### 5.2 Status

Per document, from the group's **current entry** (timeline spec §5.6):

| Condition | `status` | Colour |
|---|---|---|
| No entry in the group | `NOT_RECORDED` | grey |
| Current entry, `validUntil` null (ITP only) | `UNKNOWN` | grey |
| today > `validUntil` | `EXPIRED` | red |
| `validUntil` − today ≤ 30 days | `EXPIRING` | yellow |
| otherwise | `VALID` | green |

`daysLeft` = `validUntil` − today (negative when expired, null when no date). The 30-day threshold is the same
constant as in the timeline spec; the user's reminder days do **not** change it.

"Today" is the vehicle owner's calendar day. The server uses the same time-zone rule as the timeline status
(builder: reuse it, do not add a second one).

### 5.3 Reminder plan (pure function, on the phone)

For each car and each document with status `VALID` or `EXPIRING` and a `validUntil`:
for each `d` in `reminderDays` **plus `0` (the expiry day)**, fire at `validUntil − d` at 09:00 local, **only if that
moment is still in the future**. The `d = 0` reminder is fixed (not user-configurable) and follows the same master
switch `documentDeadlines`. Renewal needs no special case: the plan only reads the current entry, and a renewed
document yields no reminder for the old date. Known limit: a renewal recorded on another device only cancels this
device's reminder once the app is opened here and the plan is rebuilt.

Plus tire season (when `tireSeason`): the next 15 Oct and the next 1 Apr after now, per car, skipped by the rule in §3.5.

Cap: iOS keeps at most 64 pending local notifications. The plan takes the **earliest 60** by fire time over all cars.
Because the plan is rebuilt on every app open, later ones enter as earlier ones fire.

Copy comes from `en.ts` (keys under `deadlines.notification`), for example title "RCA expires in 7 days", body
"{car name}. Open to review."

## 6. Contract changes (`contracts/openapi.yaml`): do this first

- **New** `GET /vehicles/{vin}/deadlines` → `DeadlinesResponse { items: DeadlineItem[] }` always six items, fixed order
  `ITP, RCA, CASCO, ROVINIETA, FIRE_EXTINGUISHER, FIRST_AID_KIT`.
  - `DeadlineItem`: `kind` (enum above), `status` (`VALID | EXPIRING | EXPIRED | UNKNOWN | NOT_RECORDED`),
    `validUntil` (date, nullable), `daysLeft` (integer, nullable), `eventId` (nullable, the current entry).
  - Same access rules and errors as the timeline: 401, 403 consent, 404 vehicle.
- `NotificationPrefs` (settings schema) gains `tireSeason: boolean`. It is **required in responses**. On `PUT`, an
  omitted value keeps the stored one (builder: check how the other flags behave and match them).

## 7. Backend (`server/`)

- Feature `event`:
  - `application/port/in`: `DeadlinesUseCase`; `service`: `DeadlinesService` builds the six items from
    `EventRepositoryPort.validityEntries(vin)` (already specified in the timeline spec) and the status rules of
    §5.2. No new query.
  - `api`: `DeadlinesResource` (or a second method on `TimelineResource`, builder's choice), `DeadlinesResponseDto`,
    mapper.
  - `domain`: `DocumentKind` enum and the pure status function, so it is unit tested without Quarkus.
- Feature `account`:
  - `NotificationPrefs` gains `tireSeason`; `defaults()` returns `true`.
  - Flyway: `V<n>__notification_tire_season.sql` adds the column, `NOT NULL DEFAULT true`. Existing rows get `true`.
  - DTO, mapper and settings export (`OwnerDataExportAdapter`) include the field.
- Consent and ownership checks as the timeline.

## 8. Mobile (summary; details in the mobile spec)

- `features/deadlines` (new): `useDeadlines(vin)`, the reminder-plan function, the scheduler, the screen.
- The scheduler runs: on app start after sign-in, when the app returns to the foreground, after an event is created,
  edited or deleted, and when notification settings change.
- Permission is requested the first time a reminder would be scheduled, with a short explanation first. A refusal is
  remembered and shown as a note on the notification settings screen.
- Tapping a notification opens the Document status screen of that car.

## 9. Testing

- Server unit: status function over every row of §5.2, including boundaries (exactly 30 days, expiry today, expiry
  yesterday); `DeadlinesService` with fixed clock.
- Server integration: endpoint returns six items for an empty car (all `NOT_RECORDED`); a renewed RCA replaces the old
  one; CASCO absent is `NOT_RECORDED`; 403 without consent; `tireSeason` round-trips through settings.
- Mobile unit: reminder plan (future-only, 60 cap, tire-season skip, disabled switch gives an empty plan); scheduler
  cancels then schedules (mocked `expo-notifications`).
- Mobile screens: see the mobile spec.
- `ContractConformanceIT` and the mobile client types are regenerated from the contract.

## 10. Plan deliverables

- PlantUML `docs/diagrams/deadlines-reminders.puml`: the sequence (event saved → deadlines endpoint → plan →
  cancel/schedule → tap → screen).
- Gherkin for the endpoint and for the settings field, next to the existing feature files.
- ArchUnit: no change expected; `DeadlinesService` stays inside `event` and reads only its own port.

## 11. Left to the builder

- Exact copy of every notification and the Romanian strings (only `en.ts` exists today).
- Whether `DeadlinesResource` is its own class or a method on the timeline resource.
- Android notification channel name and importance (default importance, one channel `deadlines`).
- How to keep the scheduler testable (inject the notifications module and the clock).

## 12. Open questions for the owner

1. Is the grey-for-everything-missing rule (§3.1) right, or should RCA / ITP / rovinietă missing be red?
2. Are 15 October and 1 April right for the tire-season dates?
3. ~~Should expired documents keep notifying?~~ Answered 2026-11-17: no, but add one reminder on the expiry day,
   skipped if renewed (§3.7). Questions 1 and 2 stand as written (grey for missing, 15 Oct / 1 Apr).
