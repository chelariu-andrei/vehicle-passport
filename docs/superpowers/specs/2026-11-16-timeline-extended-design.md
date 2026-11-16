# Extended timeline (new event types, validity, components, custom fields, filters)

Date: 2026-11-16 · Scope: `contracts/`, `server/` (event, passport, account export, scan), `mobile/` (event feature), `web/` (public passport page) · Status: draft for approval
Follow-ups (separate specs, in this order, not here):
1. **Fuel log**: refuelling / charging with L or kWh by fuel type, and average consumption. It feeds odometer
   readings and may later appear as a monthly summary in the large timeline.
2. **Deadlines & reminders**, built on the validity data introduced here:
   - a "Document status" screen: one row per document (ITP, RCA, CASCO, rovinietă, fire extinguisher, first-aid
     kit) in green / yellow / red, with grey for "not recorded"; CASCO missing is grey, not red, because it is
     optional
   - **local** notifications (`expo-notifications`) at 30 / 7 / 1 days before expiry, configurable per user
   - tire-season reminders
   - Because notifications are local, this follow-up is mostly mobile. It may come before the fuel log; the order is
     decided when it is specced.

## 1. Intent

The timeline is the car's full history. Today it only knows four fixed kinds of work (`SERVICE, REPAIR, TIRES, ITP`)
with the same five fields. The owner wants it to hold everything that happens to a car, including paperwork with a
validity period (rovinietă, RCA, CASCO), plus events the app doesn't define ("Ceramic coating", "Detailing"), with
extra fields the user adds. The history must be filterable by **component**, **event type** and **period**. On mobile, how
each type is shown must live in **one place** instead of being spread over `display.ts`, `TimelineItem`, the form and
the detail screen.

Why structured, not free text: the follow-up reminders spec must reliably read "what is valid until when" and "RCA vs
CASCO". Free text cannot carry that.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- New event types: `ROVINIETA`, `INSURANCE`, `SAFETY_EQUIPMENT` (fire extinguisher / first-aid kit), `OTHER`
  (with a user label).
- A validity period (`validFrom`, `validUntil`) on `ROVINIETA`, `INSURANCE`, `ITP`, `SAFETY_EQUIPMENT`.
- Typed, per-type details for `INSURANCE`, `ROVINIETA`, `ITP` and `SAFETY_EQUIPMENT`. Scan details stay as they are.
- A **scanned ITP** carries its expiry date and ITP details. Its odometer reading is `DOCUMENTED`, because it went
  through OCR.
- Any event can carry up to 10 custom fields (`label` + `value`).
- Any event can be tagged with 0..n **components** from a fixed list.
- `GET /vehicles/{vin}/timeline` filters by type, component and date range, and can sort newest first.
- A server-computed **validity status** per event: only the current entry of each group gets a live marker, and
  older ones are `SUPERSEDED`.
- Odometer becomes optional where it makes no sense (rovinietă, insurance, other).
- Mobile: a single **event type registry** and a **component registry** drive the list row, detail screen, form and
  filters.
- Mobile: the compact history on the car screen **stays as it is** (rows now drawn from the registry). An
  **expand icon** opens a new full-screen **Timeline** with:
  - a vertical line with dots
  - year chips
  - type / component / period filters
  - an **aggregates card** (cost per currency, km driven, counts per type)
- `GET /vehicles/{vin}/timeline/summary` computes the aggregates server-side with the same filters.
- `web/` (public passport page) shows the new types, labels, validity, details and custom fields.

**Non-goals (this spec)**
- Reminders, push notifications, scheduled jobs, notification preferences: these belong to the follow-up spec.
- User-defined event types with their own field schema (rejected; see §4).
- User-defined components.
- Scanning (OCR) of insurance policies or rovinietă receipts. Scan confirm keeps its current types.
- Filtering by validity ("show me what's still valid"). This comes with reminders.
- Fuel / charging entries and consumption (next spec).
- Currency conversion in aggregates: totals are per currency, never summed across currencies.
- Charts. The aggregates card is numbers only in v1.
- Full-text search over notes or custom fields.

**Anti-goals**
- Breaking existing clients or existing passports. Every new field is optional or additive. The default timeline
  order stays oldest-first, and existing stored passport snapshots and hashes are never recomputed.
- Custom fields must not become a way to bypass validation. They are display-only strings, are never interpreted
  by the server, and are never used for filtering.
- An event without a kilometre reading must never be taken as "the latest odometer" or break the odometer
  consistency check.

## 3. Decisions the owner made

- Rovinietă, insurance and custom events **are timeline events**, not a separate feature.
- **Everything is public**: all types (including CASCO, policy number, insurer) show in the timeline, the passport
  snapshot and the PDF, under the same rules as today's events. There are no private-per-owner events.
- Approach **B** (below): common columns + typed details per type + custom fields.
- Reminders/notifications are a **separate feature and spec**, reading this data through
  `event.application.port.in`.
- Fuel log is a **separate feature and spec**, after this one. Fuel entries are not timeline events.
- The fire extinguisher and the first-aid kit are tracked as one type, `SAFETY_EQUIPMENT`, with an `item` detail.
  Each item is its own validity group.
- **`DOCUMENTED` stays OCR-only.** An ITP report uploaded manually as an attachment does not raise evidence; the
  event stays `USER_CONFIRMED`, as the attachments spec decided. An ITP's km becomes a documented reading only when
  the ITP is created by confirming a scan. Until OCR works, no ITP will be `DOCUMENTED` in practice.
- Document status screen and notifications go to the deadlines & reminders spec. This spec only provides the data.
- `web/` is **in scope**.
- Validity marker **option a**: only the current entry of each group shows Valid / Expiring / Expired. Superseded
  entries show no warning.
- The compact history on the car screen stays. The extended view is a separate screen, reached through an expand
  icon, with a **vertical line with dots**, year filter, the other filters, and cost and km aggregates.

## 4. Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | Common columns only (validity, components, label, custom fields). Insurer, policy and RCA/CASCO typed as custom fields | Smallest change, but "CASCO" is not structured: reminders can't rely on it, and every user names fields differently | Rejected |
| **B** | Common columns + **typed `details` per type** (`oneOf` with discriminator) + custom fields for the rest | Bigger contract and mappers, but data is reliable, the generated TS types form a discriminated union, and reminders can build on it | **Chosen** |
| C | User-defined event types with their own field schemas | Hard to filter, unpredictable in a public passport, heavy UI; `OTHER` + custom fields covers the need | Rejected |

## 5. Domain model

### 5.1 Event types

`EventType` = `SERVICE, REPAIR, TIRES, ITP, ROVINIETA, INSURANCE, SAFETY_EQUIPMENT, OTHER`.

Per-type rules (enforced in `domain`, mirrored in the mobile registry):

| Type | Odometer | Validity | Details (request) | `customLabel` |
|---|---|---|---|---|
| SERVICE, REPAIR, TIRES | required | none | none | forbidden |
| ITP | required | `validUntil` optional, `validFrom` = event date | `ItpDetails` optional | forbidden |
| ROVINIETA | optional | `validFrom` required; `validUntil` **computed** from `duration` | `RovinietaDetails` required | forbidden |
| INSURANCE | optional | `validFrom` and `validUntil` required | `InsuranceDetails` required | forbidden |
| SAFETY_EQUIPMENT | optional | `validUntil` **required**, `validFrom` = event date | `SafetyEquipmentDetails` required | forbidden |
| OTHER | optional | none | none | **required**, 1..60 chars |

**Scanned events** (`documented(...)`, source `SCAN`) follow the same table, with one exception on details:
- An event of a type with no details kind (SERVICE, REPAIR, TIRES) carries `ScanDetails`, or none.
- A scanned **ITP** carries `ItpDetails`, not `ScanDetails`:
  - `station` comes from the reviewed `serviceName`; `result` is optional;
  - `validUntil` is taken from the confirm request (optional, as for manual ITP);
  - extracted parts and labor are dropped.

  The km of a scanned ITP is `DOCUMENTED`, the same as any confirmed scan.
- Scan confirm stays limited to `SERVICE, REPAIR, TIRES, ITP`.

Cost and currency stay required for every type, as today. `0` is allowed.

Validity rules:
- `validUntil >= validFrom`.
- `validFrom` may be after the event date, for example when an RCA is bought before the old one ends. It is not
  bounded by "not in the future". Only the event `date` keeps that rule.
- Rovinietă: `validUntil` is computed in the domain from `validFrom` + `duration`. The exact end-day rule (inclusive
  end, and 12 months ending on the same calendar day or the day before) is **left to the builder**: verify it against
  the official CNAIR/roviniete.ro rules, put it in one domain function, and unit-test it. A client never sends
  `validUntil` for a rovinietă. If it does, the request is rejected (`validation-failed`).

### 5.2 Details (typed)

`details` becomes a discriminated union on a `kind` field:

- `ScanDetails` (`kind: SCAN`): `serviceName, parts, labor`. Unchanged content, still produced only by a scan
  confirm and still read-only.
- `InsuranceDetails` (`kind: INSURANCE`):
  - `coverage`: `RCA | CASCO` (required)
  - `insurer`: string 1..100 (required)
  - `policyNumber`: string ≤ 60 (optional)
- `RovinietaDetails` (`kind: ROVINIETA`): `duration`: `ONE_DAY | SEVEN_DAYS | THIRTY_DAYS | NINETY_DAYS | TWELVE_MONTHS`
  (required). The vehicle category is not stored; it can be added later.
- `ItpDetails` (`kind: ITP`):
  - `station`: string ≤ 100 (optional)
  - `result`: `PASSED | PASSED_WITH_REMARKS | FAILED` (optional)

- `SafetyEquipmentDetails` (`kind: SAFETY_EQUIPMENT`): `item`: `FIRE_EXTINGUISHER | FIRST_AID_KIT` (required).

`details.kind` must match the event type (`INSURANCE` ↔ `INSURANCE`, and so on). `SCAN` details may only sit on
events created by a scan. In the domain, `EventDetails` becomes a sealed interface with one record per kind. The
existing record becomes `ScanDetails`.

### 5.3 Components

A fixed enum `Component`:
`ENGINE, TRANSMISSION, BRAKES, SUSPENSION, STEERING, TIRES_WHEELS, ELECTRICAL, CLIMATE, BODY, EXHAUST, INTERIOR, FLUIDS, OTHER`.

- An event has `components`: a set with 0..n values, any type, order irrelevant, no duplicates. The server stores
  them sorted.
- The server applies **no** defaults. The mobile form pre-selects defaults per type (for example `TIRES` →
  `TIRES_WHEELS`), and the user can change them.

### 5.4 Custom fields

`customFields`: a list of 0..10 `{ label: 1..40 chars, value: 1..200 chars }`, trimmed, order preserved, allowed on any
type. They are display-only, never parsed or filtered by the server, and shown as `label: value` rows.

### 5.5 Editing documented events

Today a `DOCUMENTED` event accepts only a change to its notes. Extended: `notes`, `components` and `customFields` may
change, because they are annotations, not facts read from the document. Everything else stays locked
(`DocumentedEventImmutableException`).

### 5.6 Validity status (computed, not stored)

Groups:
- `INSURANCE` with `coverage = RCA`
- `INSURANCE` with `coverage = CASCO`
- `ROVINIETA`
- `ITP`
- `SAFETY_EQUIPMENT` with `item = FIRE_EXTINGUISHER` (group `EXTINGUISHER`)
- `SAFETY_EQUIPMENT` with `item = FIRST_AID_KIT` (group `FIRST_AID`)

The **current** entry of a group is the one with the latest `validFrom`; ties are broken by `createdAt`, then `id`.
For `ITP` and `SAFETY_EQUIPMENT`, `validFrom` is the event date.

| Entry | Status |
|---|---|
| Not the current entry of its group | `SUPERSEDED` |
| Current, `validUntil` null (ITP only) | `UNKNOWN` |
| Current, today > `validUntil` | `EXPIRED` |
| Current, `validUntil` − today ≤ 30 days | `EXPIRING` |
| Current, otherwise | `VALID` |
| Type without validity | `null` |

- "Today" is the server's `Clock` in UTC, the same clock used for the not-in-the-future rule.
- The 30-day threshold is a constant in the domain.
- The status is computed by the `event` application service. It looks up each group's current entry for the VIN
  with one query (`EventRepositoryPort.currentValidityEntries(vin)`), so it is correct on a filtered page too.
- It is **not** written to the passport snapshot, because it depends on the date. `web/` computes the same status
  from the snapshot's full event list, using the same rules (see §8.6).

### 5.7 Odometer

`VehicleEvent.odometerKm` becomes `Integer`, which can be null.
- `OdometerPolicy.check` is skipped when the new event has no km.
- The neighbour lookup (previous/next km) ignores events with null km.
- Mobile `latestOdometer` returns the newest event **that has km**.
- Passport snapshot, PDF and account export write `null` or omit the km.

## 6. Contract changes (`contracts/openapi.yaml`): do this first

- `EventType`: adds `ROVINIETA, INSURANCE, SAFETY_EQUIPMENT, OTHER`.
- New `SafetyEquipmentDetails` (and `SafetyItem` enum) joins both `EventDetailsInput` and `EventDetailsOutput`.
- `ConfirmScanRequest` gains `validUntil` (date, nullable) and `itpResult` (`ItpResult`, nullable). Both are allowed
  only when `type = ITP`, and refused otherwise with `validation-failed`.
- New schemas:
  - `Component` (enum)
  - `CustomField`
  - `InsuranceDetails`, `RovinietaDetails`, `ItpDetails`
  - `EventDetailsInput` = `oneOf [Insurance, Rovinieta, Itp]` with `discriminator: kind`
  - `EventDetailsOutput` = `oneOf [Scan, Insurance, Rovinieta, Itp]` with `discriminator: kind`
  - `ScanDetails` gains `kind: SCAN` (required in output)
- `EventRequest`:
  - `odometerKm` is no longer in `required` (type-dependent; the server enforces the rule, `validation-failed`)
  - new optional fields: `customLabel`, `validFrom`, `validUntil` (date), `details: EventDetailsInput | null`,
    `components: Component[]` (uniqueItems), `customFields: CustomField[]` (maxItems 10)
  - keeps `additionalProperties: false`
- `EventResponse`:
  - `odometerKm: integer | null`
  - adds `customLabel`, `validFrom`, `validUntil` (nullable)
  - adds `validityStatus`: `VALID | EXPIRING | EXPIRED | SUPERSEDED | UNKNOWN | null` (read-only, §5.6)
  - `details: EventDetailsOutput | null`
  - `components` and `customFields` are always present, possibly empty
- `GET /vehicles/{vin}/timeline` gains new query parameters:
  - `type`: array of `EventType`, `style: form, explode: true` (`?type=ITP&type=INSURANCE`); matches any of them
  - `component`: array of `Component`, same style; matches events tagged with **any** of them
  - `from`, `to`: `format: date`, inclusive, on the event `date`; `from > to` → 400 `validation-failed`
  - `order`: `asc | desc`, default `asc` (backward compatible)
  - The cursor encodes the order. A cursor used with a different `order` → 400 `invalid-cursor`. Filters are **not**
    in the cursor. The client must send the same filters on every page, and the result is defined as "the next page
    of the filtered query from that position".
- **New** `GET /vehicles/{vin}/timeline/summary` (operationId `getTimelineSummary`):
  - Same access rules and errors as the timeline: 403 consent, 404 vehicle, 400 validation.
  - Takes the same `type`, `component`, `from`, `to` params (no cursor, limit or order).
  - Returns `TimelineSummary`:
    - `eventCount`: integer
    - `countsByType`: `[{ type, count }]`, only types with count > 0
    - `costByCurrency`: `[{ currency, amount }]`, amount as a number with 2 decimals, sorted by amount descending
    - `distance`: `{ km: integer|null, fromKm: integer|null, toKm: integer|null }`. Uses **all** events of the car
      that have km in the period, ignoring the type/component filters, because distance is a property of the car.
      - `toKm` is the last reading in the period.
      - `fromKm` is the last reading **before** `from`, or else the first reading in the period.
      - `km = toKm − fromKm`, or null when fewer than two readings are available.
      - With no `from`/`to`, the period is the whole history.
    - `years`: integers, newest first. Every year that has at least one event, ignoring all filters. It drives the
      year chips.
  - Computed in SQL (aggregates), not by loading every event.
- Scan confirm (`ConfirmScanRequest.type`): limited to `SERVICE, REPAIR, TIRES, ITP`. Use a separate enum or an
  explicit refusal with `validation-failed`. **Builder's call:** a separate `ScanEventType` schema is preferred, so the
  generated mobile types stay honest.
- Passport public/snapshot schemas, if the contract describes them: add the same new event fields as optional.

## 7. Backend (`server/`, feature `event` + touched consumers)

- **Migration `V11__timeline_extended.sql`** on `vehicle_passport.vehicle_event`:
  - `odometer_km` drops `not null`
  - adds `custom_label varchar(60)`, `valid_from date`, `valid_until date`
  - adds `components text[] not null default '{}'`, `custom_fields jsonb not null default '[]'`
  - `type` stays `varchar(20)` (long enough)
  - `details jsonb` keeps its column. Existing rows get no `kind`, and the mapper reads a missing `kind` as `SCAN`.
    **Builder's call:** either backfill `kind: 'SCAN'` in the migration or tolerate it in the mapper. Pick one and test it.
  - GIN index on `components`. The existing `(vin, event_date, created_at, id)` index serves both orders.
- **Domain** (`event/domain/model`):
  - `EventType` gains the new values and a per-type rule table (odometer required? validity mode? details kind?).
    `VehicleEvent.validate` consults it.
  - New: `Component`, `CustomField`, `Validity` (value object with the rovinietă computation), sealed `EventDetails`.
  - `VehicleEvent` gains the new fields. `manual(...)` and `edited(...)` take a parameter object rather than growing
    the argument list further. **Builder's call** on the exact shape.
- **Application**:
  - `AddEventCommand` / `UpdateEventCommand` / `EventView` carry the new fields.
  - `GetTimelineUseCase.get` takes a `TimelineQuery(vin, types, components, from, to, order, cursor, limit)`.
  - `EventRepositoryPort.page(...)` takes the same filters and order.
  - New `GetTimelineSummaryUseCase` + `EventRepositoryPort.summary(TimelineFilter)` for the aggregates.
  - `EventRepositoryPort.currentValidityEntries(vin)` returns the current entry id per validity group. The service
    attaches `validityStatus` to every `EventView` it returns (timeline, single event, after add/update).
  - `EventService` skips `OdometerPolicy` for null km. Neighbour lookups ignore null km.
- **Infrastructure**:
  - `VehicleEventEntity` gets the new columns (`text[]` mapping, jsonb for details and custom fields).
  - `EventPanacheRepository.page` builds the filtered, ordered keyset query:
    - `component` uses `components && :array`
    - `desc` flips the comparison and sort on `(event_date, created_at, id)`
- **API**:
  - `EventRequest` / `EventResponse` / details DTOs follow the contract.
  - `TimelineResource` validates the new query params (enums, dates, `from <= to`) and stays thin.
  - `TimelineResource` also serves `GET .../summary` as a second method with the same filter validation.
- **Passport** (`SnapshotSourceAdapter`, `Snapshot.eventMap`, `PdfRendererAdapter`):
  - New snapshots include the new fields: type, customLabel, validity, details by kind, components, customFields.
    They are added **only when non-empty/non-null**, so a snapshot of old-style events stays byte-identical to today's
    canonical form.
  - **Snapshot shape (author's call):** scan details stay flat (`serviceName`, `parts`, `labor`) for byte
    compatibility. New details are nested under `details: { kind, ... }`, the same as the API response. New common
    fields are top-level event keys: `customLabel`, `validFrom`, `validUntil`, `components`, `customFields`.
    `PublicPassportResponse`'s description in the contract is updated to say so. The format is permanent once a
    passport is hashed.
  - The PDF shows the type label (or the custom label), validity "valid until …", insurer and coverage, and the
    custom fields.
  - Stored snapshots are not touched.
- **Account export** (`OwnerDataExportAdapter`): exports all new fields.
- **Scan**:
  - `ScanService` / `ScanDtoMapper` use the restricted scan type.
  - `EventFeatureAdapter` passes `validUntil` and `itpResult` through `SaveConfirmedEventCommand`.
  - The event feature builds `ItpDetails` for ITP and `ScanDetails` otherwise (§5.1).
  - Mobile scan review (`ReviewScreen`) shows "Valid until" and "Result" when the type is ITP.

## 8. Mobile (`mobile/`, feature `event`)

### 8.1 Central registries (the core of "centralised")

`src/features/event/model/eventTypes.ts`: one entry per `EventType`, typed `Record<EventType, EventTypeConfig>`
so a missing type fails to compile.

```ts
type EventTypeConfig = {
  icon: IconName;              // new icons as needed: road (rovinietă), shield (insurance), sparkle (other)…
  label: (lang) => string;     // from i18n (en.ts + ro.ts)
  tint: ColorToken;            // icon-tile colour from design tokens
  odometer: 'required' | 'optional';
  validity: 'none' | 'untilOptional' | 'untilRequired' | 'computed' | 'range';
  details: null | DetailsKind; // which details sub-form/renderer
  customLabel: boolean;        // OTHER only
  documentHint: (() => string) | null; // hint above the documents section; null = generic copy
  defaultComponents: Component[];
  title: (e: EventResponse) => string;     // e.g. OTHER → customLabel, scan → serviceName, INSURANCE → "RCA · Allianz"
  subtitle: (e: EventResponse) => string;  // km/cost, or "valid until 12 Mar 2027 · 1 250 RON"
};
```

`src/features/event/model/components.ts`: `Component` → label and icon. It is used by chips, the detail screen and filters.

`src/features/event/components/details/`: one renderer and one form section per details kind (`InsuranceDetailsView`,
`InsuranceDetailsFields`, …) plus `CustomFieldsView` / `CustomFieldsEditor`. These are picked through the registry,
with no `switch (type)` scattered elsewhere.

Everything that currently branches on type reads the registry: `display.ts` (`eventTitle`/`eventMeta` move into it),
`TimelineItem`, `EventDetailScreen`, `EventFormScreen`, `eventForm.ts` (the zod schema is built from the selected
type's config), `eventSummary.ts` and the confirm sheet.

### 8.2 Compact history (car screen): stays

- `HistoryList` keeps its place, layout, year grouping and data source. It has **no filters**.
- Rows are now drawn through the registry: title and subtitle from the config, plus a small type icon. The
  day/month column stays.
- The validity marker shows only for `VALID`/`EXPIRING`/`EXPIRED`:
  - "Valid until 12 Mar 2027"
  - "Expires in 12 days" (warning tone)
  - "Expired" (danger/muted tone)
  - `SUPERSEDED` and `UNKNOWN` show nothing.
- New: an **expand icon button** on the right of the "History" heading, next to the count:
  - icon `expand` (new glyph: two diagonal arrows outward)
  - a11y label "Open full timeline"
  - opens `/vehicles/[vin]/timeline`
- `fetchFullTimeline` uses `order=desc` and drops the client `reverse()`. It still serves `CarFacts`, the
  car-context screen and `latestOdometer`.

### 8.3 Full Timeline screen (new route `app/vehicles/[vin]/timeline.tsx`)

Layout, top to bottom:

```
┌ ← Timeline · <make model>                   ┐
│ [2026] [2025] [2024] [All years]   ← years  │
│ [Type ▾] [Component ▾] [Period ▾]   Clear   │
│ ┌ Cost  4 850 RON · 320 EUR ──────────────┐ │
│ │ Km driven 12 400 km  · 14 events        │ │
│ │ Service 5 · Insurance 3 · Repair 2 …    │ │
│ └─────────────────────────────────────────┘ │
│ 2026                                         │
│  ●─ 12 Mar  RCA · Allianz        Valid      │
│  │          1 250 RON · until 12 Mar 2027   │
│  ●─ 02 Feb  Oil change          Engine      │
│  │          98 400 km · 450 RON             │
│ 2025                                         │
│  ●─ …                                        │
│           [ Load more ]                      │
└──────────────────────────────────────────────┘
```

- **Vertical line with dots**: a new `TimelineRail` component in the event feature.
  - A continuous hairline in `line` colour runs down the left gutter.
  - One dot per event, filled with the type's `tint` from the registry.
  - The line breaks at year headers. Documented/verified events get a ring around the dot, so evidence is visible
    on the rail too.
  - Rows reuse the content of the compact row (title, subtitle, component chips max 2 + "+n", attachments,
    evidence badge, validity marker).
- **Year chips** (horizontal scroll):
  - built from `summary.years`, plus "All years" (default)
  - one active year at a time
  - selecting a year sets `from = YYYY-01-01`, `to = YYYY-12-31`
- **Filters**: Type, Component, Period, each opening a bottom sheet.
  - Type / Component: multi-select from the registries.
  - Period: presets (last 12 months, this year, last year) and custom from/to with the existing calendar pickers.
  - Choosing a custom Period clears the year chip, and choosing a year replaces the Period.
  - "Clear" resets everything.
  - Active chips show a count or the range.
- **Aggregates card**: from `GET .../timeline/summary` with the same filters.
  - cost per currency, joined with " · "
  - km driven; "—" when null, with a hint "needs two odometer readings"
  - event count and counts per type (top 4, then "+n")
  - skeleton while loading; on error the card shows a small retry and the list stays usable
- **List**: an infinite query on the filtered timeline (`order=desc`, page 20) inside a `FlatList`/`SectionList`
  grouped by year. It loads more on scroll; "Load more" is the fallback, which is the builder's call. The query key
  includes the filters.
- Empty result with filters → `EmptyState` "No events match these filters" + "Clear filters". Without filters →
  the existing empty state.
- Filters live in the screen state for the session. Persisting them is the **builder's call**.
- New design primitives: `FilterChip` and a generic `SelectSheet` (modelled on `ConfirmSheet`). Tokens only. New
  icons as needed.
- Pull-to-refresh refetches both the list and the summary. Adding, editing or deleting an event invalidates both.

### 8.4 Event form

- Type picker shows all eight types (grid with icons, from the registry). Safety equipment asks for the item and
  "valid until".
- After a type is chosen, the form shows only the fields its config asks for:
  - odometer (required/optional)
  - validity:
    - ROVINIETA: `validFrom` + duration chips, with the computed end shown read-only
    - INSURANCE: `validFrom` + quick presets 1/6/12 months that fill `validUntil`, still editable
    - ITP: optional "valid until"
  - details section
  - `customLabel` for OTHER
- Common to all types:
  - components multi-select (pre-filled from `defaultComponents`)
  - a "Custom fields" editor (add/remove rows, max 10)
  - notes
- **Manual file upload for every type.** The existing `DocumentsSection` (attachments spec, 0..10 JPEG/PNG/PDF,
  ≤ 10 MB) stays in the form for all eight types:
  - paperwork types show a hint from the registry (`documentHint`):
    - INSURANCE: "Attach the policy (photo or PDF)"
    - ITP: "Attach the inspection report"
    - ROVINIETA: "Attach the receipt"
    - SAFETY_EQUIPMENT: "Attach the receipt or a photo of the label"
  - Upload stays **optional** and **never raises evidence**: the event stays `USER_CONFIRMED`.
  - Attachments stay private to the owner who created the event, as the attachments spec decided. Buyers and the
    public passport see the event's data (insurer, validity…) but never the policy file, which may hold personal
    data.
- `toEventRequest` keeps the rules for DOCUMENTED events: only notes, components and customFields come from the form.
- The rovinietă end date is computed **only on the server**. The client shows a preview with the same function,
  ported to TS, kept in `model/validity.ts` and tested against the same cases as the Java one.

### 8.5 Other mobile touch-points
- `latestOdometer` skips null km.
- i18n:
  - all new labels in **both** `en.ts` and `ro.ts`
  - Romanian terms: "Rovinietă", "Asigurare (RCA/CASCO)", "Altele"
- Regenerate `src/shared/api/generated/schema.d.ts` from the contract.
- Fake API (`test/fake-api/handlers.ts`) supports the new fields, filters, `validityStatus` and the summary endpoint.

### 8.6 Public passport page (`web/`)

- `web/src/snapshot.ts` parses the new snapshot fields (§7 snapshot shape). Unknown keys stay ignored, so older
  snapshots still parse.
- `web/src/render.ts`:
  - the hard-coded `TYPES` label table covers all eight types; `OTHER` shows `customLabel`, `SAFETY_EQUIPMENT` shows the item
  - each event shows its validity range, insurer and coverage, rovinietă duration, ITP station and result,
    components, and custom fields as `label: value` rows
- The validity marker is computed on the page with the same §5.6 rules, against the viewer's today. Superseded
  entries show none.
- `web/features/buyer.feature` gains scenarios for the new types and markers. `npm run check` stays green.

## 9. Testing

- **Domain unit tests**:
  - the per-type rule table (every type × odometer/validity/details/label combination)
  - the rovinietă `validUntil` computation (each duration, month ends, leap years)
  - editing documented events (annotations allowed, facts locked)
  - null-km odometer policy
- **Persistence IT**:
  - round-trip of every new field
  - old `details` rows without `kind` read as SCAN
  - filter combinations × `asc`/`desc` × paging, with no duplicates or gaps across pages
  - an `order` mismatch on the cursor → `invalid-cursor`
- **Resource IT / cucumber** (`features/event/*.feature`):
  - create one of each new type
  - validation failures (missing insurer, rovinietă with client `validUntil`, OTHER without label, `from > to`, unknown
    component)
  - filters through HTTP
- **Passport**:
  - a snapshot of old-style events is byte-identical to before (golden test)
  - new fields appear in the snapshot and the PDF
- **Mobile**:
  - registry completeness (type-level, plus a test that every type renders a row)
  - form schema per type
  - `validity.ts` against the shared cases
  - year chips / filters → query params, for both list and summary
  - full Timeline screen: rail rendering, empty and filtered states, summary card states
  - expand button navigation from the compact history
  - timeline steps in `mobile/features/timeline.feature` extended for the new screen, filters and new types
- **Summary IT**:
  - cost per currency with mixed currencies
  - counts per type
  - distance: reading before `from`, fewer than two readings → null
  - distance ignores type/component filters
  - `years` ignores filters
- **Validity status**:
  - unit tests for every status
  - RCA and CASCO as separate groups
  - ties on `validFrom`
  - status correct on a filtered page that doesn't contain the current entry
- **web/**: parser and render for every new type, validity markers, an old snapshot still renders.

## 10. Plan deliverables: diagrams, Gherkin, ArchUnit

The implementation plan must include these as tasks. They are part of "done", not extras.

### 10.1 PlantUML (`docs/diagrams/timeline-extended.puml`, written with this spec)

| Diagram | Shows |
|---|---|
| `timeline-extended-components` | event feature layers after the change; passport/account/scan consumers via port/in |
| `timeline-extended-domain` | `VehicleEvent`, `EventType` + `TypeRule`, sealed `EventDetails`, `Validity`, `Component`, `CustomField`, `ValidityStatusPolicy` |
| `timeline-extended-query-seq` | filtered/desc timeline request, cursor order check, validity status attachment |
| `timeline-extended-summary-seq` | summary endpoint and which filters each aggregate honours |
| `timeline-extended-add-seq` | add event with per-type rules, rovinietă computation, optional odometer check |
| `timeline-extended-mobile` | compact history → full Timeline screen, registries, details renderers, new primitives |
| `timeline-extended-validity-state` | validity status transitions |

The plan's last task updates the diagrams to match what was actually built. It also updates
`docs/diagrams/event-timeline.puml`: `event-add-seq` gains the optional odometer branch.

### 10.2 ArchUnit (`server/src/test/java/.../architecture/ArchitectureTest.java`)

The existing rules keep passing. The plan adds these in its first backend task, before the code they guard. Rules
1–2 start red until the new domain types exist, and rules 3–5 hold today and freeze the current state:

1. **Domain sealed details stay in domain:** every class implementing `event.domain.model.EventDetails` resides in
   `..event.domain.model..`.
2. **Policies are domain:** classes whose simple name ends with `Policy` reside in `..domain..`. This covers
   `OdometerPolicy` and `ValidityStatusPolicy`.
3. **DTOs don't leak:** no class outside `..api..` depends on `..api.dto..`.
4. **Domain types stay out of DTOs:** classes in `..api.dto..`, across all features, do not depend on `..domain..`.
   DTOs carry their own enums or strings, and mapping happens in `api.mapper`. This holds today, so the rule
   freezes it.
5. **Event's port/in is domain-free:** classes in `..event.application.port.in..` do not depend on
   `..event.domain..`. `EventView`, `TimelinePage` and the new summary/query records expose strings, JDK types and
   `port.in` records only.
   - Why: `passport`, `account` and `scan` consume these records across features, and a domain type there would
     sneak `event.domain` past `cross_feature_only_via_port_in`.
   - This holds today, so the rule freezes it.
   - It is scoped to `event` on purpose: `account` and `scan` port/in already use their own domain types, and that
     is out of scope here.

Mobile has no ArchUnit. Its equivalent is a Jest **registry rule** test that fails when:
- a file under `src/features/event/components/**` or `src/features/vehicle/**` compares on event types
  (`event.type ===`, or `switch (` over `.type`) outside `model/eventTypes.ts`;
- `EVENT_TYPE_CONFIG` or `COMPONENT_CONFIG` misses an enum value from the generated schema (runtime check on top of
  the type-level `Record`).

### 10.3 Gherkin

New or extended feature files. Step definitions are written in the same task as the code they drive.

**Server**: `server/src/integration-test/resources/features/event/timeline_extended.feature`

```gherkin
Feature: Extended timeline

  Background:
    Given I own vehicle V

  Scenario: Insurance requires coverage and insurer
    When I add an INSURANCE event without details
    Then the answer is 400 "validation-failed"

  Scenario: CASCO is stored with its validity
    When I add an INSURANCE event with coverage CASCO, insurer "Allianz", valid 2026-03-12 to 2027-03-11
    Then the event shows coverage CASCO and validUntil 2027-03-11
    And its odometer is empty

  Scenario: Rovinietă end date is computed by the server
    When I add a ROVINIETA event valid from 2026-01-15 for TWELVE_MONTHS
    Then validUntil is the date the official rule gives for that start

  Scenario: A client may not set the rovinietă end date
    When I add a ROVINIETA event with a validUntil
    Then the answer is 400 "validation-failed"

  Scenario: Other needs a label
    When I add an OTHER event without customLabel
    Then the answer is 400 "validation-failed"

  Scenario: Safety equipment needs an expiry date
    When I add a SAFETY_EQUIPMENT event for FIRE_EXTINGUISHER without validUntil
    Then the answer is 400 "validation-failed"

  Scenario: Extinguisher and first-aid kit are separate groups
    Given V has a FIRST_AID_KIT valid until 2027-05-01 and a FIRE_EXTINGUISHER that expired on 2026-01-01
    When I request the timeline
    Then the first-aid kit is VALID
    And the extinguisher is EXPIRED

  Scenario: A renewed extinguisher supersedes the old one
    Given V has a FIRE_EXTINGUISHER valid until 2026-01-01
    When I add a FIRE_EXTINGUISHER valid until 2027-01-01
    Then the older one has validityStatus SUPERSEDED and stays in the timeline

  Scenario: A scanned ITP carries its expiry and a documented reading
    When I confirm a scan as ITP with serviceName "RAR Iasi", odometer 120000 km, validUntil 2028-03-01 and result PASSED
    Then the event has evidence DOCUMENTED, details kind ITP with station "RAR Iasi" and validUntil 2028-03-01

  Scenario: An ITP with an uploaded report stays confirmed
    Given V has a manual ITP event
    When I attach a PDF report to it
    Then its evidence is still USER_CONFIRMED

  Scenario: Validity fields on a non-ITP scan are refused
    When I confirm a scan as SERVICE with a validUntil
    Then the answer is 400 "validation-failed"

  Scenario: Custom fields are kept in order
    When I add an OTHER event "Ceramic coating" with custom fields "Layers"="3" and "Warranty"="5 years"
    Then the event shows those custom fields in that order

  Scenario: More than ten custom fields are refused
    When I add an event with 11 custom fields
    Then the answer is 400 "validation-failed"

  Scenario: An event without kilometres does not break the odometer check
    Given V has a SERVICE at 2025-01-10 with 100000 km
    When I add an INSURANCE event on 2025-02-01 without kilometres
    And I add a SERVICE at 2025-03-01 with 101000 km
    Then both are accepted

  Scenario: A scanned event accepts new components and custom fields
    Given V has a DOCUMENTED event
    When I change its components to BRAKES and add a custom field
    Then the change is saved
    But changing its cost is refused with 409 "documented-event-immutable"

  Scenario Outline: Filtering the timeline
    Given V has a SERVICE tagged ENGINE in 2024, a REPAIR tagged BRAKES in 2025 and an INSURANCE RCA in 2025
    When I request the timeline with <query>
    Then I see <result>

    Examples:
      | query                            | result                    |
      | type=REPAIR&type=INSURANCE       | the REPAIR and the RCA    |
      | component=BRAKES                 | the REPAIR                |
      | from=2025-01-01&to=2025-12-31    | the REPAIR and the RCA    |
      | component=ENGINE&from=2025-01-01 | nothing                   |

  Scenario: Newest first, paged without gaps
    Given V has 5 events
    When I read the timeline 2 at a time with order=desc
    Then I see all 5 events exactly once, newest first

  Scenario: A cursor is bound to its order
    Given I hold a cursor from an ascending page
    When I use it with order=desc
    Then the answer is 400 "invalid-cursor"

  Scenario: An inverted period is refused
    When I request the timeline with from=2025-12-31&to=2025-01-01
    Then the answer is 400 "validation-failed"

  Scenario: Only the current policy carries a live status
    Given today is 2026-11-16
    And V has an RCA valid 2024-11-01 to 2025-10-31 and an RCA valid 2025-11-01 to 2026-12-01
    When I request the timeline
    Then the older RCA has validityStatus SUPERSEDED
    And the newer RCA has validityStatus EXPIRING

  Scenario: RCA and CASCO are separate groups
    Given V has a current RCA and an older CASCO that expired
    When I request the timeline
    Then the RCA is VALID or EXPIRING
    And the CASCO is EXPIRED

  Scenario: The status is right on a filtered page
    Given V has an RCA from 2024 and a newer RCA from 2026
    When I request the timeline with to=2024-12-31
    Then the 2024 RCA has validityStatus SUPERSEDED

  Scenario: Summary per currency
    Given V has events costing 100 RON, 250 RON and 40 EUR
    When I request the summary
    Then costByCurrency is 350 RON and 40 EUR

  Scenario: Kilometres driven in a year
    Given V has readings 90000 km on 2024-12-20, 95000 km on 2025-06-01 and 102000 km on 2025-12-01
    When I request the summary for 2025
    Then distance is 12000 km from 90000 to 102000

  Scenario: Kilometres ignore the type filter
    Given V has a SERVICE at 100000 km and a REPAIR at 104000 km in 2025
    When I request the summary for 2025 with type=SERVICE
    Then distance is 4000 km

  Scenario: Not enough readings
    Given V has one reading in 2025
    When I request the summary for 2025 with no earlier readings
    Then distance km is empty

  Scenario: Years ignore filters
    Given V has events in 2023 and 2025
    When I request the summary with type=ITP
    Then years are 2025 and 2023
```

Existing files gain scenarios:
- `features/passport/passport.feature`:
  - "A passport over old-style events has the same hash as before"
  - "A passport shows the insurer, validity and custom fields"
- `features/scan/review.feature`: "A scan cannot be confirmed as ROVINIETA"

**Mobile**: `mobile/features/timeline.feature` (extended) + `mobile/features/timeline-full.feature` (new)

```gherkin
Feature: Full timeline

  Scenario: The compact history opens the full timeline
    Given a car with events
    When I tap "Open full timeline" next to History
    Then the Timeline screen opens for that car

  Scenario: Events sit on a rail, newest first, grouped by year
    Given the API returns events from 2024 and 2026
    When I open the full timeline
    Then I see the 2026 group above 2024
    And each event has a dot in its type colour on the rail

  Scenario: Picking a year filters the list and the summary
    Given the summary lists years 2026, 2025
    When I pick 2025
    Then the timeline and the summary are requested with from=2025-01-01 and to=2025-12-31

  Scenario: Type and component filters combine
    When I filter by type Insurance and component Brakes
    Then the requests carry type=INSURANCE and component=BRAKES
    And the filter chips show their counts

  Scenario: Nothing matches
    Given the filtered timeline is empty
    Then I see "No events match these filters"
    And "Clear filters" resets every filter

  Scenario: Costs per currency
    Given the summary has 350 RON and 40 EUR
    Then the summary card shows "350 RON · 40 EUR"

  Scenario: Kilometres not known
    Given the summary distance is empty
    Then the card shows "—" with "needs two odometer readings"

  Scenario: The summary fails but the list works
    Given the summary request fails
    Then the summary card offers retry
    And the events are still listed

  Scenario: Only the current policy shows a marker
    Given an RCA marked SUPERSEDED and an RCA marked EXPIRING in 12 days
    Then only the newer RCA shows "Expires in 12 days"
```

```gherkin
# added to mobile/features/timeline.feature
  Scenario: Adding insurance asks for what insurance needs
    When I add an event of type Insurance
    Then I am asked for coverage, insurer and the validity period
    And kilometres are optional

  Scenario: Rovinietă shows its computed end
    When I add a Rovinietă from 15 Jan 2026 for 12 months
    Then the form previews the end date
    And the request carries no validUntil

  Scenario: Other needs a name
    When I add an event of type Other without a name
    Then I cannot save

  Scenario: Safety equipment asks for item and expiry
    When I add an event of type Safety equipment
    Then I choose between fire extinguisher and first-aid kit
    And "valid until" is required

  Scenario Outline: Paperwork can carry its file
    When I add an event of type <type>
    Then the documents section says "<hint>"
    And I can attach a photo or PDF before saving

    Examples:
      | type             | hint                                         |
      | Insurance        | Attach the policy (photo or PDF)             |
      | ITP              | Attach the inspection report                 |
      | Rovinietă        | Attach the receipt                           |
      | Safety equipment | Attach the receipt or a photo of the label   |

  Scenario: A CASCO saved with its policy file
    When I add a CASCO with insurer "Allianz" and attach "polita.pdf"
    Then the event is created and the file is uploaded to it
    And the entry shows 1 document and evidence "confirmed"

  Scenario: Reviewing a scanned ITP asks for its expiry
    Given a scan under review
    When I set its type to ITP
    Then I can enter "Valid until" and the result

  Scenario: Components are suggested by type
    When I add an event of type Tires
    Then component "Tires & wheels" is preselected

  Scenario: Custom fields
    When I add two custom fields to an event
    Then they appear on the event in the order I added them

  Scenario: A scanned event lets me tag it
    Given a DOCUMENTED event
    When I edit it
    Then notes, components and custom fields can be changed
    And the request resends the original facts

  Scenario: The latest kilometres skip entries without kilometres
    Given the newest event is an insurance without kilometres
    Then the car shows the kilometres of the newest event that has them
```

**Web**: `web/features/buyer.feature` gains:

```gherkin
  Scenario: A buyer sees insurance with its validity
    Given a passport with a CASCO from Allianz valid until a future date
    Then the entry reads "CASCO · Allianz" with its validity range

  Scenario: Superseded paperwork shows no warning
    Given a passport with two RCA policies, the older one expired
    Then only the newer RCA shows a validity marker

  Scenario: A custom event shows its name and fields
    Given a passport with an OTHER event "Ceramic coating" and a custom field "Layers: 3"
    Then the entry shows "Ceramic coating" and "Layers: 3"

  Scenario: An old passport still renders
    Given a passport snapshot from before this change
    Then every entry renders as before
```

## 11. Left to the builder (explicitly)

- The exact rovinietă end-date rule (verify against official sources; one function, tested on both sides).
- Backfill vs. mapper default for the `kind` of old details.
- The parameter-object shape for `VehicleEvent` factories.
- The row layout detail (where day/month goes once the icon tile is added) and the new icon glyphs.
- Whether filters persist across app restarts.
- Infinite scroll vs. "Load more" on the full Timeline screen.
- The exact rail visuals (dot size, ring for evidence) within the design tokens.
- Separate `ScanEventType` schema vs. refusing new types at scan confirm (separate schema preferred).
