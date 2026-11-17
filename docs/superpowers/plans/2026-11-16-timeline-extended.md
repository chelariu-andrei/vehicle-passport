# Extended Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the timeline with these features:
- new event types (rovinietă, insurance, safety equipment, other)
- a scanned ITP that carries its expiry date
- a validity period with a computed status
- typed details, components and custom fields
- server-side filters and a summary endpoint
- a full Timeline screen on mobile, built on central registries
- the public passport page (`web/`) rendering all of it

**Architecture:** Everything stays inside the existing `event` feature (hexagonal).
- The domain gains a per-type rule table (`EventType.rule()`), a sealed `EventDetails`, `Validity` and
  `ValidityStatusPolicy`.
- The repository gains filtered/ordered keyset paging and SQL aggregates.
- `passport`, `account` and `scan` consume the new fields through `event.application.port.in` only.
- Mobile centralises per-type behaviour in `EVENT_TYPE_CONFIG` / `COMPONENT_CONFIG`. A new route
  `/vehicles/[vin]/timeline` shows the rail, filters and summary.

**Tech Stack:**
- Server: Quarkus, Hibernate ORM (Panache-style repository with `EntityManager`), Flyway, Postgres (`text[]`,
  `jsonb`), Cucumber (`quarkus-cucumber`), ArchUnit 1.5.1.
- Mobile: Expo + expo-router, TanStack Query, openapi-fetch, zod, jest + jest-cucumber steps.
- Web: Hono-style `html` templates, cucumber-js.

**Spec:** `docs/superpowers/specs/2026-11-16-timeline-extended-design.md`
**Diagrams:** `docs/diagrams/timeline-extended.puml`

## Global Constraints

- Contract first. `contracts/openapi.yaml` changes before any code (Task 1). After it changes, run
  `npm run gen:api` in `mobile/`.
- Hexagonal rules (`.claude/rules/backend-architecture.md`):
  - `domain` is pure Java.
  - `@Transactional` only in `application/service`.
  - Other features use `event` only through `event.application.port.in`.
- `event.application.port.in` records carry strings, JDK types and port.in records only. They never carry
  `event.domain` types (ArchUnit rule 5).
- Migration: `V11__timeline_extended.sql` (next free number). Applied migrations are never edited.
- Backward compatibility:
  - Default timeline `order` is `asc`.
  - A request with only the old six fields still works.
  - A 3-part cursor issued before this change decodes as `asc`.
  - A passport snapshot of old-style events is byte-identical.
- Exact limits:
  - `customLabel` 1..60
  - custom field `label` 1..40 and `value` 1..200, after trim; at most 10 per event
  - `insurer` 1..100, `policyNumber` ≤ 60, `station` ≤ 100
  - EXPIRING threshold: 30 days
  - summary/timeline page size on mobile: 20
- `DOCUMENTED` evidence comes **only** from a confirmed scan. Attachments never raise evidence, and no task may add
  a manual path to `DOCUMENTED`.
- Error codes: reuse `validation-failed` (400), `invalid-cursor` (400), `documented-event-immutable` (422),
  `odometer-inconsistent` (422), `vehicle-not-found` (404).
- Rovinietă end date (spec §10 leaves it to the builder). The plan pins it as:
  - an N-day vignette ends on `validFrom + (N − 1) days`;
  - `TWELVE_MONTHS` ends on `validFrom + 12 months − 1 day`.
  - **Before Task 3 is merged, verify this against erovinieta.ro / CNAIR.** If it differs, change only
    `RovinietaDuration.endFor` and `validity.ts`, plus their shared test table.
- Copy: every new string goes in **both** `mobile/src/shared/i18n/en.ts` and `ro.ts`. Romanian terms are
  "Rovinietă", "Asigurare", "Altele", "Valabil până la …", "Expiră în … zile", "Expirat".
- Server tests:
  - Use the Quarkus MCP (`quarkus_callTool` → `devui-testing_runTest {"className": "..."}`), as `server/AGENTS.md`
    requires.
  - Fallback from `server/`: `mvn -q test -Dtest=<Class>` for unit tests, `mvn -q verify` for integration and
    cucumber.
- Mobile: `npx jest <path>` and `npm run check`. Web: `npm run check` in `web/`.
- Commit after each task. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **An old app build sends only `{type, date, odometerKm, costAmount, currency, notes}`.** It must get 201, with
  `components: []`, `customFields: []` and null validity. Pinned in Task 5 (`legacy request still accepted`).
- **A cursor from before the deploy** (3 parts, no order) is used after it. It must continue ascending, not 400.
  Pinned in Task 3 (`TimelineCursorTest.legacyCursorDecodesAsAsc`).
- **A row written before V11** (details JSON without `kind`, default `components`/`custom_fields`) is read, edited
  and saved. It must round-trip as SCAN details and must not throw. Pinned in Task 4 (`preMigrationRowRoundTrips`).
- **An edit changes the type** from INSURANCE to SERVICE while the form still holds insurance details and validity.
  The mobile request must drop them, and the server must refuse leftovers with 400. Pinned in Task 5 (server) and
  Task 13 (`toEventRequest drops fields the new type does not use`).
- **The current RCA is deleted.** The previous RCA must stop being `SUPERSEDED` and get a live status again. Pinned
  in Task 7 (`deleting the current entry revives the previous one`).

---

## File Structure

Server (`server/src/main/java/com/vehiclepassport/server/`):
- `event/domain/model/`:
  - new: `Component`, `CustomField`, `Validity`, `RovinietaDuration`, `InsuranceCoverage`, `ItpResult`,
    `DetailsKind`, `ScanDetails`, `InsuranceDetails`, `RovinietaDetails`, `ItpDetails`, `TypeRule`, `EventFacts`,
    `EventAnnotations`, `ValidityGroup`, `ValidityStatus`, `ValidityStatusPolicy`, `TimelineOrder`, `EventFilter`,
    `TimelineSummary`
  - changed: `EventDetails` (record → sealed interface), `EventType`, `VehicleEvent`, `TimelineCursor`
- `event/domain/exception/InvalidTimelineFilterException.java` (new, `validation-failed`).
- `event/application/port/in/`:
  - new: `EventInput`, `CustomFieldView`, `TimelineFilterView`, `TimelineQuery`, `GetTimelineSummaryUseCase`,
    `TimelineSummaryView`
  - changed: `AddEventCommand`, `UpdateEventCommand`, `EventView`, `DetailsView`, `GetTimelineUseCase`
- `event/application/port/out/EventRepositoryPort.java`: `page`, `summary`, `validityEntries`.
- `event/application/service/EventService.java`, plus a new `event/application/service/EventInputs.java` (port.in →
  domain conversion).
- `event/infrastructure/persistence/entity/VehicleEventEntity.java`,
  `.../repository/EventPanacheRepository.java`.
- `event/api/TimelineResource.java`, `event/api/dto/*` (`EventRequest`, `EventResponse`, `DetailsDto`,
  `CustomFieldDto`, `TimelineSummaryResponse`), `event/api/mapper/EventDtoMapper.java`.
- `passport/...`: `SnapshotEvent`, `Snapshot`, `SnapshotSourceAdapter`, `PdfRendererAdapter`.
- `account/infrastructure/adapter/OwnerDataExportAdapter.java`.
- `scan/api/dto/ConfirmScanRequest` (type pattern), `scan/infrastructure/client/EventFeatureAdapter.java`.
- `resources/db/migration/V11__timeline_extended.sql`.

Mobile (`mobile/`):
- `src/features/event/model/`:
  - new: `eventTypes.ts`, `components.ts`, `validity.ts`, `timelineFilters.ts`
  - changed: `display.ts` (keeps `groupByYear`, `dayAndMonth`), `eventForm.ts`, `timeline.ts`, `eventSummary.ts`
- `src/features/event/api/`: new `useTimelinePages.ts`, `useTimelineSummary.ts`; `useTimeline.ts` unchanged.
- `src/features/event/components/`:
  - `details/` (per-kind View + Fields, `CustomFieldsView`, `CustomFieldsEditor`, `ComponentPicker`)
  - `TimelineScreen.tsx`, `TimelineRail.tsx`, `YearChips.tsx`, `FilterBar.tsx`, `SummaryCard.tsx`
  - edits to `TimelineItem.tsx`, `HistoryList.tsx`, `EventFormScreen.tsx`, `EventDetailScreen.tsx`
- `src/shared/design/primitives/FilterChip.tsx`, `SelectSheet.tsx`, plus `Icon.tsx` glyphs: `expand`, `road`,
  `sparkle`, `filter`.
- `src/shared/api/queryKeys.ts`, `src/shared/i18n/en.ts`, `ro.ts`.
- `app/vehicles/[vin]/timeline.tsx`.
- `test/fake-api/handlers.ts`, `test/steps/timeline.steps.tsx`, `test/steps/timeline-full.steps.tsx`,
  `features/timeline-full.feature`.

Web (`web/`): `src/snapshot.ts`, `src/render.ts`, new `src/validity.ts`, `features/buyer.feature` (+ its steps).

---

### Task 1: Contract

**Files:**
- Modify: `contracts/openapi.yaml`
- Regenerate: `mobile/src/shared/api/generated/schema.d.ts`

**Interfaces:**
- Produces (schema names later tasks use):
  - enums: `EventType` (8 values), `ScanEventType` (`SERVICE, REPAIR, TIRES, ITP`), `Component` (13 values,
    spec §5.3), `InsuranceCoverage`, `RovinietaDuration`, `ItpResult`, `SafetyItem`
    (`FIRE_EXTINGUISHER, FIRST_AID_KIT`), `ValidityStatus`
  - objects: `CustomField`, `ScanDetails` (+ `kind: SCAN`), `InsuranceDetails`, `RovinietaDetails`, `ItpDetails`,
    `SafetyEquipmentDetails`, `EventDetailsInput`, `EventDetailsOutput` (`discriminator: { propertyName: kind }`),
    `TimelineSummary`, `TypeCount`, `CurrencyAmount`, `Distance`
  - operation `getTimelineSummary`
  - `ConfirmScanRequest` gains `validUntil` (date, nullable) and `itpResult` (`ItpResult`, nullable)

- [ ] **Step 1: Edit the contract.** Follow spec §6 exactly.
  - `EventRequest`:
    - `required: [type, date, costAmount, currency]`
    - new optional properties per §6
    - `components` has `uniqueItems: true`; `customFields` has `maxItems: 10`
  - `EventResponse`:
    - `odometerKm: [integer, 'null']`
    - required gains `components, customFields`
    - add `validityStatus` (`oneOf [ValidityStatus, null]`, readOnly)
  - `/vehicles/{vin}/timeline`:
    - `type`/`component` are arrays with `style: form, explode: true`
    - `from`/`to` are `format: date`
    - `order` is an enum `[asc, desc]`, default `asc`
  - New path `/vehicles/{vin}/timeline/summary`.
  - The `ConfirmScanRequest.type` reference becomes `ScanEventType`.
  - Update the `PublicPassportResponse` description with the snapshot shape from spec §7.
- [ ] **Step 2: Regenerate and check.** Run in `mobile/`: `npm run gen:api && npm run check:contract && npm run typecheck`.
  Expected: gen and contract check pass. Typecheck **fails** only in files that use `EVENT_TYPES`,
  `odometerKm: number` or `details.serviceName`. Note them; Tasks 11–14 fix them. Fix scan's review picker now:
  `mobile/src/features/scan/**` uses `components['schemas']['ScanEventType']`.
- [ ] **Step 3: Commit.** `git add contracts/openapi.yaml mobile/src/shared/api/generated mobile/src/features/scan && git commit -m "feat(contracts): extended timeline types, filters and summary"`

### Task 2: ArchUnit freeze rules (3–5)

**Files:**
- Modify: `server/src/test/java/com/vehiclepassport/server/architecture/ArchitectureTest.java`

- [ ] **Step 1: Add three rules** (spec §10.2, rules 3–5):

```java
@ArchTest static final ArchRule dtos_stay_in_api = noClasses()
    .that().resideOutsideOfPackage("..api..")
    .should().dependOnClassesThat().resideInAPackage("..api.dto..");

@ArchTest static final ArchRule dtos_do_not_use_domain = noClasses()
    .that().resideInAPackage("..api.dto..")
    .should().dependOnClassesThat().resideInAPackage("..domain..");

@ArchTest static final ArchRule event_port_in_is_domain_free = noClasses()
    .that().resideInAPackage(BASE + ".event.application.port.in..")
    .should().dependOnClassesThat().resideInAPackage(BASE + ".event.domain..");
```

- [ ] **Step 2: Run.** `ArchitectureTest`. Expected: PASS. These rules freeze the current state; if one fails, the
  current code already breaks it, so stop and report.
- [ ] **Step 3: Commit.** `test(arch): freeze dto and event port.in boundaries`

### Task 3: Domain: types, details, validity, rules, cursor

**Files:**
- Create (all in `event/domain/model/`):
  - enums: `Component`, `RovinietaDuration`, `InsuranceCoverage`, `ItpResult`, `SafetyItem`, `DetailsKind`,
    `TimelineOrder`
  - records: `CustomField`, `Validity`, `ScanDetails`, `InsuranceDetails`, `RovinietaDetails`, `ItpDetails`,
    `SafetyEquipmentDetails`, `TypeRule`, `EventFacts`, `EventAnnotations`
- Modify: `EventDetails.java` (becomes a sealed interface), `EventType.java`, `VehicleEvent.java`,
  `OdometerPolicy.java`, `TimelineCursor.java`.
- Modify callers so they compile: `EventService`, `EventPanacheRepository` (`new EventDetails(...)` →
  `new ScanDetails(...)`).
- Test:
  - `server/src/test/java/.../event/domain/` (new): `VehicleEventRulesTest`, `RovinietaDurationTest`,
    `CustomFieldTest`
  - extended: `TimelineCursorTest`, `OdometerPolicyTest`
  - `ArchitectureTest` (rules 1–2)

**Interfaces (Produces):**

```java
enum OdometerRule { REQUIRED, OPTIONAL }
enum ValidityRule { NONE, UNTIL_OPTIONAL, UNTIL_REQUIRED, COMPUTED, RANGE }
record TypeRule(OdometerRule odometer, ValidityRule validity, DetailsKind detailsKind /*nullable*/,
                boolean detailsRequired, boolean customLabelRequired) {}
// EventType: SERVICE, REPAIR, TIRES, ITP, ROVINIETA, INSURANCE, SAFETY_EQUIPMENT, OTHER;  TypeRule rule();  static EventType parse(String)
sealed interface EventDetails permits ScanDetails, InsuranceDetails, RovinietaDetails, ItpDetails, SafetyEquipmentDetails { DetailsKind kind(); }
record SafetyEquipmentDetails(SafetyItem item) implements EventDetails {}
record ScanDetails(String serviceName, List<PartLine> parts, BigDecimal labor) implements EventDetails {}
record InsuranceDetails(InsuranceCoverage coverage, String insurer, String policyNumber) implements EventDetails {}
record RovinietaDetails(RovinietaDuration duration) implements EventDetails {}
record ItpDetails(String station, ItpResult result) implements EventDetails {}
enum RovinietaDuration { ONE_DAY, SEVEN_DAYS, THIRTY_DAYS, NINETY_DAYS, TWELVE_MONTHS; LocalDate endFor(LocalDate from); }
record Validity(LocalDate validFrom, LocalDate validUntil /*nullable only for ITP*/) {}
record CustomField(String label, String value) {}          // compact ctor trims and validates
record EventFacts(EventType type, LocalDate date, Integer odometerKm, BigDecimal costAmount, String currency,
                  String customLabel, LocalDate validFrom, LocalDate validUntil, EventDetails details) {}
record EventAnnotations(String notes, Set<Component> components, List<CustomField> customFields) {}
// VehicleEvent gains: Integer odometerKm, String customLabel, Validity validity, EventDetails details,
//   Set<Component> components (sorted, unmodifiable), List<CustomField> customFields
static VehicleEvent manual(String vin, EventFacts f, EventAnnotations a, UUID createdBy, UUID periodId, Clock clock);
static VehicleEvent documented(String vin, EventFacts f, EventAnnotations a, UUID createdBy, UUID periodId, Clock clock);
VehicleEvent edited(EventFacts f, EventAnnotations a, Clock clock);
enum TimelineOrder { ASC, DESC; static TimelineOrder parse(String) }
record TimelineCursor(TimelineOrder order, LocalDate date, Instant createdAt, UUID id) {
  String encode();                                           // "ORDER|date|createdAt|id"
  static TimelineCursor decode(String cursor, TimelineOrder expected); // 3-part legacy → ASC; mismatch → InvalidCursorException
}
OdometerPolicy.check(Integer previousKm, Integer km, Integer nextKm);   // km == null → no check
```

Rule table (`EventType.rule()`), copied from spec §5.1:

| Type | odometer | validity | detailsKind | detailsRequired | customLabelRequired |
|---|---|---|---|---|---|
| SERVICE, REPAIR, TIRES | REQUIRED | NONE | null | false | false |
| ITP | REQUIRED | UNTIL_OPTIONAL | ITP | false | false |
| ROVINIETA | OPTIONAL | COMPUTED | ROVINIETA | true | false |
| INSURANCE | OPTIONAL | RANGE | INSURANCE | true | false |
| SAFETY_EQUIPMENT | OPTIONAL | UNTIL_REQUIRED | SAFETY_EQUIPMENT | true | false |
| OTHER | OPTIONAL | NONE | null | false | true |

Validation in `VehicleEvent`. Any breach throws `InvalidEventException`.
- Odometer: km is required when the rule says REQUIRED; when present it must be ≥ 0.
- Validity, by rule:
  - NONE: `validFrom` and `validUntil` must both be null.
  - UNTIL_OPTIONAL: `validFrom` must be null; store `Validity(date, validUntil)`, and only when `validUntil` is not null.
  - UNTIL_REQUIRED: `validFrom` must be null and `validUntil` is required (≥ date); store `Validity(date, validUntil)`.
  - COMPUTED: `validFrom` is required, `validUntil` must be null; store `Validity(from, duration.endFor(from))`.
  - RANGE: both are required, with `validUntil >= validFrom`.
- Details:
  - must be null when `detailsKind` is null;
  - `kind` must equal `detailsKind`;
  - required when `detailsRequired`;
  - `ScanDetails` is accepted only through `documented(...)`.
  - The scan exception (spec §5.1): in `documented(...)`, a type whose `detailsKind` is null accepts `ScanDetails` or
    null, and ITP requires `ItpDetails` (never `ScanDetails`). Without this, today's scans would be refused.
- Insurance details: `insurer` trimmed to 1..100, `policyNumber` ≤ 60; ITP `station` ≤ 100.
- `customLabel`: trimmed to 1..60 when required, null otherwise.
- `customFields` ≤ 10.
- `edited` on an event that is `DOCUMENTED` or higher: compare `EventFacts` with the current facts (same rules as
  today, extended to the new fact fields). Any change throws `DocumentedEventImmutableException`. Annotations
  (notes, components, customFields) always apply.

- [ ] **Step 1: Add ArchUnit rules 1–2** (spec §10.2), red until the types exist:

```java
@ArchTest static final ArchRule event_details_stay_in_domain = classes()
    .that().implement(BASE + ".event.domain.model.EventDetails")
    .should().resideInAPackage("..event.domain.model..");
@ArchTest static final ArchRule policies_are_domain = classes()
    .that().haveSimpleNameEndingWith("Policy").and().areTopLevelClasses()
    .should().resideInAPackage("..domain..");
```

- [ ] **Step 2: Write failing domain tests.**
  - `VehicleEventRulesTest`, a parameterised table with one case per row:
    - `insuranceWithoutDetailsRefused`
    - `insuranceUntilBeforeFromRefused`
    - `rovinietaWithClientUntilRefused`
    - `rovinietaUntilComputed` (2026-01-15 + TWELVE_MONTHS → 2027-01-14)
    - `itpUntilStoredWithFromEqualDate`
    - `serviceWithDetailsRefused`
    - `serviceWithoutKmRefused`
    - `insuranceWithoutKmAccepted`
    - `otherWithoutLabelRefused`
    - `labelOnServiceRefused`
    - `elevenCustomFieldsRefused`
    - `manualWithScanDetailsRefused`
    - `documentedAcceptsAnnotationChanges`
    - `documentedRefusesCostChange`
    - `safetyEquipmentWithoutUntilRefused`
    - `safetyEquipmentUntilStoredWithFromEqualDate`
    - `documentedServiceAcceptsScanDetails` (guards today's scans)
    - `documentedItpRequiresItpDetails`
    - `documentedItpWithScanDetailsRefused`
  - `RovinietaDurationTest`:
    - ONE_DAY 2026-03-10 → 2026-03-10
    - SEVEN_DAYS → 2026-03-16
    - THIRTY_DAYS → 2026-04-08
    - NINETY_DAYS → 2026-06-07
    - TWELVE_MONTHS 2024-02-29 → 2025-02-27
    - TWELVE_MONTHS 2026-01-31 → 2027-01-30
  - `CustomFieldTest`:
    - `"  Layers "` trims to `"Layers"`
    - blank label refused
    - 41-char label refused
    - 201-char value refused
  - `TimelineCursorTest`:
    - `legacyCursorDecodesAsAsc`: a base64 of `"2025-01-01|2025-01-01T10:00:00Z|<uuid>"` decoded with ASC → ok;
      with DESC → `InvalidCursorException`
    - `roundTripDesc`
  - `OdometerPolicyTest`: `nullKmSkipsCheck`.
- [ ] **Step 3: Run them.** Expected: compile errors / FAIL.
- [ ] **Step 4: Implement** the interfaces above. `EventService` and `EventPanacheRepository` keep compiling with a
  minimal adaptation:
  - build `EventFacts` / `EventAnnotations` from the current commands (empty components and custom fields);
  - `ScanDetails` replaces `new EventDetails(...)`;
  - `TimelineCursor.decode(cursor, ASC)`.
- [ ] **Step 5: Run** all domain tests and `ArchitectureTest`. Expected: PASS. Then run all server unit tests: PASS.
- [ ] **Step 6: Commit.** `feat(event): domain rules for new types, validity, details, components and custom fields`

### Task 4: Migration and persistence

**Files:**
- Create: `server/src/main/resources/db/migration/V11__timeline_extended.sql`
- Modify: `VehicleEventEntity.java`, `EventPanacheRepository.java`
- Test: `server/src/integration-test/java/.../event/EventPersistenceIT.java`

**Interfaces:**
- Consumes: Task 3 domain types.
- Produces (entity columns): `odometerKm Integer`, `customLabel`, `validFrom`, `validUntil`, `components String[]`,
  `customFields List<CustomFieldJson>`, `details DetailsJson` with a nullable `kind` and fields for every kind.

- [ ] **Step 1: Write the migration.**

```sql
alter table vehicle_passport.vehicle_event
    alter column odometer_km drop not null,
    add column custom_label  varchar(60),
    add column valid_from    date,
    add column valid_until   date,
    add column components    text[] not null default '{}',
    add column custom_fields jsonb  not null default '[]';
create index vehicle_event_components on vehicle_passport.vehicle_event using gin (components);
```

  `kind` is not backfilled. The mapper reads a missing `kind` as SCAN; this is the decision on spec §11.
- [ ] **Step 2: Write failing ITs** in `EventPersistenceIT`:
  - `roundTripsEveryNewField`: one event per type with all fields set, saved and read back equal
  - `preMigrationRowRoundTrips`: insert with native SQL a row with `details = '{"serviceName":"X","parts":[],"labor":null}'`
    and no new columns; read it → `ScanDetails("X", [], null)`, empty components and fields; edit notes and save; read again
  - `neighboursIgnoreEventsWithoutKm`: SERVICE 100000 km on D1, INSURANCE without km on D2, check at D3 → previous
    = 100000
- [ ] **Step 3: Run.** Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Entity mappings: `@JdbcTypeCode(SqlTypes.ARRAY)` for `components` and `@JdbcTypeCode(SqlTypes.JSON)` for
    `custom_fields`, the same as the existing `details`.
  - `toJson` / `toDomain` switch on `EventDetails` / `kind`.
  - `neighbours` adds `and e.odometerKm is not null` to both queries.
- [ ] **Step 5: Run** `EventPersistenceIT` and the existing event ITs. Expected: PASS.
- [ ] **Step 6: Commit.** `feat(event): persist validity, components, custom fields and typed details`

### Task 5: Add / update / read through the API

**Files:**
- Modify (`event/application/port/in/`): `AddEventCommand`, `UpdateEventCommand`, `EventView`, `DetailsView`
- Create (`event/application/port/in/`): `EventInput`, `CustomFieldView`
- Create: `event/application/service/EventInputs.java`
- Modify: `EventService`
- Modify (`event/api/`): `dto/EventRequest`, `dto/EventResponse`, `mapper/EventDtoMapper`
- Create: `event/api/dto/DetailsDto`, `event/api/dto/CustomFieldDto`
- Modify the callers of `DetailsView` / `SaveConfirmedEventCommand`: `scan/infrastructure/client/EventFeatureAdapter.java`
- Modify `scan/api/dto` so the confirm request uses the pattern `SERVICE|REPAIR|TIRES|ITP`
- Test:
  - `server/src/integration-test/resources/features/event/timeline_extended.feature`: the create, validation, custom
    field, odometer and documented scenarios from spec §10.3
  - `server/src/integration-test/java/.../event/steps/TimelineExtendedSteps.java`, following the pattern in
    `EventSteps.java`
  - `server/src/integration-test/resources/features/scan/review.feature`: "A scan cannot be confirmed as ROVINIETA"

**Interfaces (Produces):**

```java
record CustomFieldView(String label, String value) {}
record DetailsView(String kind, String serviceName, List<PartView> parts, BigDecimal labor,
                   String coverage, String insurer, String policyNumber, String duration,
                   String station, String result, String item) {
  static DetailsView scan(String serviceName, List<PartView> parts, BigDecimal labor);
}
record EventInput(String type, LocalDate date, Integer odometerKm, BigDecimal costAmount, String currency,
                  String notes, String customLabel, LocalDate validFrom, LocalDate validUntil,
                  DetailsView details, List<String> components, List<CustomFieldView> customFields) {}
record AddEventCommand(UUID userId, String vin, EventInput input) {}
record UpdateEventCommand(UUID userId, String vin, UUID eventId, EventInput input) {}
record EventView(UUID id, String type, LocalDate date, Integer odometerKm, BigDecimal costAmount, String currency,
                 String notes, String customLabel, LocalDate validFrom, LocalDate validUntil, DetailsView details,
                 List<String> components, List<CustomFieldView> customFields, String validityStatus,
                 String evidence, String source, boolean documentPresent, int attachmentCount) {}
// EventInputs (application/service): static EventFacts facts(EventInput); static EventAnnotations annotations(EventInput);
//   unknown enum strings (component, coverage, duration, result, kind) → InvalidEventException
```

`SaveConfirmedEventCommand` gains `LocalDate validUntil, String itpResult`. In `EventService.save`:
- type ITP → `ItpDetails(serviceName, itpResult)` and validity `UNTIL_OPTIONAL`;
- other types → `ScanDetails` as today.

The scan confirm mapper refuses `validUntil`/`itpResult` on a non-ITP type with `validation-failed`. This check sits
in the scan feature's application service, not the resource.

`validityStatus` is `null` in this task; Task 7 fills it. `DetailsDto` is one flat record with
`@JsonInclude(NON_NULL)`, so each kind serialises to exactly its `oneOf` shape. A null `components` /
`customFields` in a request means empty.

- [ ] **Step 1: Write the feature file and the step class** for the scenarios listed above, plus
  `legacy request still accepted`:
  - POST `{type: SERVICE, date, odometerKm: 1000, costAmount: 10, currency: RON}`
  - → 201, `components == []`, `customFields == []`, `validFrom == null`, `validityStatus == null`
- Also add `type change with leftover details refused`: PUT a SERVICE with `details.kind = INSURANCE` → 400
  `validation-failed`.
- Also add the spec §10.3 scenarios:
  - "Safety equipment needs an expiry date"
  - "A scanned ITP carries its expiry and a documented reading"
  - "An ITP with an uploaded report stays confirmed"
  - "Validity fields on a non-ITP scan are refused"

  The last three use the scan and attachment steps that already exist in `scan/steps` and `AttachmentSteps`.
- [ ] **Step 2: Run** the cucumber IT. Expected: the new scenarios FAIL.
- [ ] **Step 3: Implement** the port.in records, `EventInputs`, the mapper and DTOs. `EventService.add/update` use
  `EventInputs`; `EventService.save` (scan) uses `VehicleEvent.documented` with `ScanDetails`. `EventView.odometerKm`
  is now `Integer`, so `SnapshotSourceAdapter`, `PdfRendererAdapter` and `OwnerDataExportAdapter` must accept null km
  just to keep compiling; Task 9 adds their new fields.
- [ ] **Step 4: Run** all event and scan ITs plus `ArchitectureTest`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(event): accept and return new types, validity, details, components, custom fields`

### Task 6: Timeline filters and order

**Files:**
- Create: `event/domain/model/EventFilter.java`, `event/domain/exception/InvalidTimelineFilterException.java`,
  `event/application/port/in/TimelineFilterView.java`, `event/application/port/in/TimelineQuery.java`
- Modify: `GetTimelineUseCase`, `EventService.get`, `EventRepositoryPort.page`, `EventPanacheRepository.page`,
  `TimelineResource`, `shared/error` mapping (the new exception → 400 `validation-failed`)
- Test:
  - `EventFilterTest` (unit)
  - `timeline_extended.feature`: the filtering outline, newest-first paging, cursor/order, inverted period
  - existing `features/event/timeline.feature` stays green

**Interfaces (Produces):**

```java
record EventFilter(Set<EventType> types, Set<Component> components, LocalDate from, LocalDate to) {
  // ctor: from > to → InvalidTimelineFilterException; null sets → empty (= no filter)
  static EventFilter none();
}
record TimelineFilterView(List<String> types, List<String> components, LocalDate from, LocalDate to) {}
record TimelineQuery(UUID userId, String vin, TimelineFilterView filter, String order, String cursor, int limit) {}
interface GetTimelineUseCase { TimelinePage get(TimelineQuery q); }
List<VehicleEvent> page(String vin, EventFilter f, TimelineOrder order, TimelineCursor after, int limit); // port.out
```

`TimelineResource.get` gains these parameters:
- `@QueryParam("type") List<String>`
- `@QueryParam("component") List<String>`
- `@QueryParam("from") @Pattern(regexp="\\d{4}-\\d{2}-\\d{2}") String`, and the same for `to`
- `@QueryParam("order") @DefaultValue("asc") @Pattern(regexp="asc|desc") String`

The mapper parses the dates. An impossible date (`2025-02-30`) throws `InvalidTimelineFilterException`.

Repository: one JPQL built from fragments.
- Components need a native predicate, so `page` uses a **native query** when components are given:
  `components && cast(:components as text[])`. Mapping to the entity stays via `addEntity`/result class. This is the
  builder's call between that and always-native.
- DESC flips the keyset comparison and uses the `DESC` order string.
- The cursor is encoded with the query's order.

- [ ] **Step 1: Write the failing tests** listed above. `EventFilterTest`: `fromAfterToRefused`, `nullSetsMeanAll`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the event ITs, the cucumber suite and `ArchitectureTest`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(event): filter and order the timeline`

### Task 7: Validity status

**Files:**
- Create (`event/domain/model/`): `ValidityGroup`, `ValidityStatus`, `ValidityStatusPolicy`
- Modify: `EventRepositoryPort` (+ `validityEntries`), `EventPanacheRepository`, `EventService` (all `toView` paths)
- Test: `ValidityStatusPolicyTest` (unit); `timeline_extended.feature`: the validity-status scenarios (RCA, CASCO, filtered page, extinguisher/first-aid) plus
  `deleting the current entry revives the previous one`

**Interfaces (Produces):**

```java
enum ValidityGroup { RCA, CASCO, ROVINIETA, ITP, EXTINGUISHER, FIRST_AID }
enum ValidityStatus { VALID, EXPIRING, EXPIRED, SUPERSEDED, UNKNOWN }
final class ValidityStatusPolicy {
  static final int EXPIRING_DAYS = 30;
  static Optional<ValidityGroup> group(VehicleEvent e);
  static Set<UUID> currentIds(List<VehicleEvent> validityEntries);  // max by (validFrom, createdAt, id) per group
  static ValidityStatus status(VehicleEvent e, boolean current, LocalDate today); // null when no group
}
List<VehicleEvent> validityEntries(String vin);   // port.out: active ROVINIETA, INSURANCE, ITP, SAFETY_EQUIPMENT events of the VIN
```

This replaces spec §5.6's `currentValidityEntries(vin)`. The repository returns the entries, and the domain picks
the current ones, so the "current" rule lives in one tested place. `EventService` computes
`currentIds(events.validityEntries(vin))` once per request, with `today = LocalDate.now(clock)` (UTC), and passes
the status name into `EventView`.

- [ ] **Step 1: Write the failing tests.** `ValidityStatusPolicyTest`:
  - `olderSameGroupSuperseded`
  - `rcaAndCascoSeparate`
  - `extinguisherAndFirstAidSeparate`
  - `tieBrokenByCreatedAtThenId`
  - `itpWithoutUntilUnknown`
  - `expiringAt30Days` (until − today = 30 → EXPIRING; 31 → VALID)
  - `expiredDayAfter` (today = until → EXPIRING; until + 1 → EXPIRED)
  - `serviceHasNoStatus`

  Plus the cucumber scenarios, including "Extinguisher and first-aid kit are separate groups" and "A renewed
  extinguisher supersedes the old one". The Background clock is fixed at 2026-11-16 through the existing test `Clock`
  producer.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the domain tests and event ITs. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(event): compute validity status per group`

### Task 8: Summary endpoint

**Files:**
- Create:
  - `event/domain/model/TimelineSummary.java`
  - `event/application/port/in/`: `GetTimelineSummaryUseCase.java`, `TimelineSummaryView.java`
  - `event/api/dto/TimelineSummaryResponse.java`
- Modify: `EventRepositoryPort` (+ `summary`), `EventPanacheRepository`, `EventService`, `TimelineResource`
  (+ `@GET @Path("summary")`), `EventDtoMapper`
- Test: `timeline_extended.feature`, the five summary scenarios from spec §10.3

**Interfaces (Produces):**

```java
record TimelineSummary(long eventCount, Map<EventType, Long> countsByType, Map<String, BigDecimal> costByCurrency,
                       Integer fromKm, Integer toKm, List<Integer> years) {
  Integer distanceKm();   // toKm - fromKm; null when either is null (the repository returns fromKm = null when it would be the same event as toKm)
}
TimelineSummary summary(String vin, EventFilter f);          // port.out
interface GetTimelineSummaryUseCase { TimelineSummaryView summary(UUID userId, String vin, TimelineFilterView f); }
record TimelineSummaryView(long eventCount, List<TypeCountView> countsByType, List<CurrencyAmountView> costByCurrency,
                           Integer distanceKm, Integer fromKm, Integer toKm, List<Integer> years) {}
record TypeCountView(String type, long count) {}
record CurrencyAmountView(String currency, BigDecimal amount) {}
```

SQL rules (spec §6):
- count, counts by type and cost by currency honour **all** filters.
- `toKm` is the km of the last km-bearing event with `date <= to` (or the latest overall) **and**
  `date >= from` when `from` is given.
- `fromKm` is the km of the last km-bearing event with `date < from`; if there is none, or no `from`, it is the
  first km-bearing event in the period.
- `distanceKm` is null when fewer than two distinct readings back it, i.e. `fromKm` and `toKm` come from the same
  event.
- `years`: `select distinct extract(year from event_date)`, active events of the VIN, newest first, with no filters.
- Cost amounts are scaled to 2 decimals; `costByCurrency` is sorted by amount descending.

- [ ] **Step 1: Write the failing scenarios.**
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Track the "same event" condition by selecting ids along with the km values.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(event): timeline summary endpoint`

### Task 9: Passport snapshot, PDF, account export

**Files:**
- Modify (`passport/`): `domain/model/SnapshotEvent.java`, `domain/model/Snapshot.java`,
  `infrastructure/client/SnapshotSourceAdapter.java`, `infrastructure/client/PdfRendererAdapter.java`
- Modify: `account/infrastructure/adapter/OwnerDataExportAdapter.java`
- Test:
  - `server/src/test/java/.../passport/domain/SnapshotGoldenTest.java` (new)
  - `features/passport/passport.feature`: two scenarios
  - account export IT: assert the new keys

**Interfaces:**
- Consumes: the `EventView` fields from Task 5.
- Produces: `SnapshotEvent` gains `customLabel, validFrom, validUntil, SnapshotDetails details /*nullable, non-scan kinds only*/, List<String> components, List<SnapshotCustomField> customFields`.

`Snapshot.eventMap`:
- Writes the existing keys exactly as today.
- Then **only when non-null/non-empty**: `customLabel`, `validFrom`, `validUntil`, `details` (`{kind, ...}` for
  INSURANCE/ROVINIETA/ITP), `components`, `customFields` (`[{label, value}]`).
- Scan details stay flat. `validityStatus` is never written.

- [ ] **Step 1: Write `SnapshotGoldenTest.oldStyleEventsUnchanged`.** It builds a snapshot from two old-style events
  and asserts `canonicalJson` and `hash` equal string literals captured **before** this task's code changes. Run it on
  the current code first to capture the values, then commit the test with them. Add `newFieldsAppearOnlyWhenSet`.
- [ ] **Step 2: Run.** Expected: golden PASS, new test FAIL.
- [ ] **Step 3: Implement.**
  - Snapshot map as above.
  - PDF line: `<label or customLabel> · <coverage · insurer>` and `valid <from>–<until>`; custom fields as indented
    `label: value` lines; km omitted when null.
  - The export adds all new fields.
- [ ] **Step 4: Run** the passport and account tests and ITs. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(passport): carry extended event fields into snapshot, PDF and export`

### Task 10: Public passport page (`web/`)

**Files:**
- Modify: `web/src/snapshot.ts`, `web/src/render.ts`
- Create: `web/src/validity.ts`
- Test: `web/features/buyer.feature` (4 scenarios from spec §10.3) + its step file

**Interfaces (Produces):**

```ts
// snapshot.ts — SnapshotEvent gains:
customLabel: string | null; validFrom: string | null; validUntil: string | null;
details: { kind: 'INSURANCE'; coverage: 'RCA' | 'CASCO'; insurer: string; policyNumber: string | null }
       | { kind: 'ROVINIETA'; duration: string } | { kind: 'ITP'; station: string | null; result: string | null }
       | { kind: 'SAFETY_EQUIPMENT'; item: 'FIRE_EXTINGUISHER' | 'FIRST_AID_KIT' } | null;
components: string[]; customFields: { label: string; value: string }[];
// validity.ts
export type ValidityStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'SUPERSEDED' | 'UNKNOWN';
export function validityStatuses(events: SnapshotEvent[], today: string): Map<SnapshotEvent, ValidityStatus>;
```

`validity.ts` implements spec §5.6 over the snapshot. Snapshot events carry no `createdAt`, so ties on `validFrom`
are broken by array order: the later one in the snapshot wins. Groups include EXTINGUISHER and FIRST_AID. `TYPES`
covers 8 types; `SAFETY_EQUIPMENT` shows the item name ("Fire extinguisher" / "First-aid kit"), and `OTHER` uses
`customLabel`.

- [ ] **Step 1: Write the four scenarios.**
- [ ] **Step 2: Run** `npm run check` in `web/`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check`. Expected: PASS, including the "old passport still renders" scenario.
- [ ] **Step 5: Commit.** `feat(web): show extended events on the public passport`

### Task 11: Mobile registries

**Files:**
- Create (`mobile/src/features/event/model/`): `eventTypes.ts`, `components.ts`, `validity.ts`, and tests
  `eventTypes.test.ts`, `validity.test.ts`
- Create: `mobile/test/registryRule.test.ts`
- Modify:
  - `display.ts`: remove `eventTitle`/`eventMeta`; callers use the registry
  - `timeline.ts`: `order: 'desc'`, no `reverse()`; `latestOdometer` skips null km
  - `timeline.test.ts`
  - `Icon.tsx`: glyphs `expand`, `road`, `sparkle`, `filter`, `kit` (safety equipment)
  - `en.ts`, `ro.ts`

**Interfaces (Produces):**

```ts
export type EventType = components['schemas']['EventType'];
export type Component = components['schemas']['Component'];
export type EventTypeConfig = {
  icon: IconName; tint: ColorToken; label: () => string;
  odometer: 'required' | 'optional';
  validity: 'none' | 'untilOptional' | 'untilRequired' | 'computed' | 'range';
  details: 'INSURANCE' | 'ROVINIETA' | 'ITP' | 'SAFETY_EQUIPMENT' | null;
  customLabel: boolean; defaultComponents: Component[];
  documentHint: (() => string) | null;   // INSURANCE, ITP, ROVINIETA, SAFETY_EQUIPMENT: copy from spec §8.4; others null
};
export const EVENT_TYPES: readonly EventType[];                       // display order
export const EVENT_TYPE_CONFIG: Record<EventType, EventTypeConfig>;
export function eventTitle(e: EventResponse): string;    // OTHER→customLabel; scan→serviceName; INSURANCE→"RCA · Allianz"; SAFETY_EQUIPMENT→item label; else label
export function eventSubtitle(e: EventResponse): string; // validity types: "until 12 Mar 2027 · 1 250 RON"; else "98 400 km · 450 RON"; km omitted when null
// components.ts
export const COMPONENTS: readonly Component[];
export const COMPONENT_CONFIG: Record<Component, { icon: IconName; label: () => string }>;
// validity.ts
export function rovinietaEnd(from: string, duration: RovinietaDuration): string;   // same table as Task 3
export function validityMarker(e: EventResponse, today: string):
  { tone: 'ok' | 'warn' | 'danger'; text: string } | null;   // null for SUPERSEDED, UNKNOWN, null status
```

`validityMarker` uses the server's `validityStatus` and computes only the text:
- VALID → "Valid until 12 Mar 2027"
- EXPIRING → "Expires in N days", with N = days from `today` to `validUntil`
- EXPIRED → "Expired"

`defaultComponents`: TIRES → `TIRES_WHEELS`; every other type → `[]`.

- [ ] **Step 1: Write the failing tests.**
  - `eventTypes.test.ts`:
    - every `EventType` from the schema (list it explicitly) has a config entry
    - `eventTitle` for OTHER, scan, insurance and service
    - `eventSubtitle` omits km when null
  - `validity.test.ts`: the same `rovinietaEnd` table as `RovinietaDurationTest`; one marker per status.
  - `timeline.test.ts`:
    - `latestOdometer skips events without km`
    - the request carries `order: 'desc'`
  - `registryRule.test.ts`: reads every `.ts/.tsx` under `src/features/event/components` and `src/features/vehicle`
    and fails on `/\.type\s*===/` or `/switch\s*\([^)]*\.type\)/`.
- [ ] **Step 2: Run** `npx jest src/features/event/model test/registryRule.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Move every type-based branch out of components and into the registry until the rule
  test passes.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS. Typecheck errors from Task 1 in components may remain only in
  `EventFormScreen`/`EventDetailScreen`; if so, Tasks 13–14 fix them, so run `npx jest` alone here.
- [ ] **Step 5: Commit.** `feat(mobile): central event type and component registries`

### Task 12: Compact history rows and the expand button

**Files:**
- Modify: `TimelineItem.tsx`, `HistoryList.tsx`, `test/fake-api/handlers.ts` (new fields, `order`, filters,
  `validityStatus`, `/timeline/summary`), `test/steps/timeline.steps.tsx`, `mobile/features/timeline.feature`
- Create: an empty route stub `mobile/app/vehicles/[vin]/timeline.tsx` rendering `TimelineScreen`. Task 16 fills it;
  for now it renders a placeholder `Screen` with the title.

**Interfaces:**
- Consumes: `eventTitle`, `eventSubtitle`, `validityMarker`, `EVENT_TYPE_CONFIG` (Task 11).

- [ ] **Step 1: Add scenarios.**
  - `timeline.feature`:
    - "The latest kilometres skip entries without kilometres"
    - "Only the current policy shows a marker"
    - "The compact history opens the full timeline": tap the a11y label "Open full timeline" → route
      `/vehicles/V/timeline`
  - Update "Newest first across pages": the fake API serves `order=desc`.
- [ ] **Step 2: Run** `npx jest test/steps/timeline.steps.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Row: a type icon tile (24px, tinted), the day/month column kept, title/subtitle from the registry, up to 2
    component chips + "+n", the attachment count, the evidence badge, and the validity marker text under the
    subtitle.
  - Heading: an `expand` icon button, 44×44 hit area.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(mobile): registry-driven history rows and full-timeline entry`

### Task 13: Event form per type

**Files:**
- Modify: `eventForm.ts`, `eventForm.test.ts`, `eventSummary.ts`, `EventFormScreen.tsx`
- Create (`components/details/`): `InsuranceDetailsFields.tsx`, `RovinietaDetailsFields.tsx`,
  `ItpDetailsFields.tsx`, `SafetyEquipmentDetailsFields.tsx`, `CustomFieldsEditor.tsx`, `ComponentPicker.tsx`
- Modify scan review: `mobile/src/features/scan/components/ReviewScreen.tsx`,
  `mobile/src/features/scan/model/confirmRequest.ts` (+ test). When the type is ITP, review reuses
  `ItpDetailsFields` (result) plus an optional "Valid until" date. `toConfirmRequest` sends `validUntil`/`itpResult`
  only for ITP.
- Test: `test/steps/timeline.steps.tsx` (form scenarios from spec §10.3, including "Safety equipment asks for item
  and expiry"), `test/steps/review.steps.tsx` ("Reviewing a scanned ITP asks for its expiry"),
  `confirmRequest.test.ts` (`non-ITP confirm never sends validUntil`). Add "Paperwork can carry its file" (outline)
  and "A CASCO saved with its policy file" to `timeline.steps.tsx`, reusing the staged-file helpers from
  `event.documents.test.tsx`.
- `DocumentsSection` stays rendered for **every** type. It takes a new optional `hint?: string` prop, fed from
  `EVENT_TYPE_CONFIG[type].documentHint?.()`. No change to upload, limits or evidence.

**Interfaces (Produces):**

```ts
export function eventFormSchema(type: EventType, maxDate: string): z.ZodType<EventForm>; // built from EVENT_TYPE_CONFIG[type]
export type EventForm = {
  type: EventType; date: string; odometerKm: number | null; costAmount: number; currency: string; notes: string;
  customLabel: string | null; validFrom: string | null; validUntil: string | null;
  details: EventRequest['details']; components: Component[]; customFields: { label: string; value: string }[];
};
export function toEventRequest(original: EventResponse | null, form: EventForm): EventRequest;
```

`toEventRequest`:
- Sends only the fields the selected type's config uses. Others are omitted, never sent stale.
- Never sends `validUntil` for ROVINIETA.
- For DOCUMENTED originals: facts come from the original, and notes/components/customFields come from the form.

- [ ] **Step 1: Write the failing tests.**
  - `eventForm.test.ts`:
    - `toEventRequest drops fields the new type does not use` (insurance form switched to SERVICE → no `details`,
      `validFrom`, `validUntil`)
    - `rovinietă request has no validUntil`
    - `OTHER without label is invalid`
    - `11 custom fields invalid`
    - `insurance km optional`
    - `documented keeps facts, takes annotations`
  - Steps: the scenarios "Adding insurance…", "Rovinietă shows its computed end", "Other needs a name",
    "Components are suggested by type", "Custom fields", "A scanned event lets me tag it".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Type picker: a grid of `EVENT_TYPES` with icons.
  - Sections appear from the config:
    - rovinietă: duration chips plus the read-only end preview via `rovinietaEnd`
    - insurance: 1/6/12-month presets that fill `validUntil`
  - Changing type resets the type-specific fields and preselects `defaultComponents`.
  - `eventSummary.ts` (the confirm sheet rows) lists the new fields.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(mobile): event form adapts to each type`

### Task 14: Event detail renderers

**Files:**
- Create (`components/details/`): `InsuranceDetailsView.tsx`, `RovinietaDetailsView.tsx`, `ItpDetailsView.tsx`,
  `SafetyEquipmentDetailsView.tsx`, `ScanDetailsView.tsx` (moved from `EventDetailScreen`), `CustomFieldsView.tsx`
- Create: `components/details/index.ts`, exporting `DETAILS_VIEW: Record<'SCAN'|'INSURANCE'|'ROVINIETA'|'ITP'|'SAFETY_EQUIPMENT', ComponentType<{ details: ... }>>`
- Modify: `EventDetailScreen.tsx`
- Test: `test/steps/event.details.extended.test.tsx` (new). It renders one event per type and asserts the visible
  rows: insurer and coverage, validity range, duration, station and result, custom fields in order, component chips.

- [ ] **Step 1: Write the failing test.**
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `EventDetailScreen` picks the renderer with `DETAILS_VIEW[event.details.kind]`, with no
  type switch.
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(mobile): detail screen renders typed details and custom fields`

### Task 15: Design primitives FilterChip and SelectSheet

**Files:**
- Create: `mobile/src/shared/design/primitives/FilterChip.tsx`, `SelectSheet.tsx`
- Modify: `mobile/src/shared/design/index.ts`, `primitives.test.tsx`

**Interfaces (Produces):**

```ts
export function FilterChip(p: { label: string; active: boolean; badge?: string; onPress(): void; accessibilityLabel?: string }): JSX.Element;
export function SelectSheet<T extends string>(p: {
  visible: boolean; title: string; options: { value: T; label: string; icon?: IconName }[];
  selected: T[]; multiple: boolean; onChange(next: T[]): void; onClose(): void;
}): JSX.Element;
```

Built like `ConfirmSheet`. Tokens only. `FilterChip` minimum height is 36 and its hit area 44. `SelectSheet` rows are
checkbox rows with `accessibilityRole="checkbox"` and `accessibilityState.checked`.

- [ ] **Step 1: Write failing tests** in `primitives.test.tsx`:
  - `FilterChip shows badge and active state`
  - `SelectSheet toggles multiple values`
  - `SelectSheet single mode replaces value`
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.** `feat(design): FilterChip and SelectSheet`

### Task 16: Full Timeline screen

**Files:**
- Create (`mobile/src/features/event/`):
  - `model/timelineFilters.ts` (+ test)
  - `api/useTimelinePages.ts`, `api/useTimelineSummary.ts`
  - `components/`: `TimelineScreen.tsx`, `TimelineRail.tsx`, `YearChips.tsx`, `FilterBar.tsx`, `SummaryCard.tsx`
- Create: `mobile/features/timeline-full.feature`, `mobile/test/steps/timeline-full.steps.tsx`
- Modify: `mobile/app/vehicles/[vin]/timeline.tsx`, `src/shared/api/queryKeys.ts`, `src/features/event/index.ts`

**Interfaces (Produces):**

```ts
export type TimelineFilters = { types: EventType[]; components: Component[]; year: number | null; from: string | null; to: string | null };
export const EMPTY_FILTERS: TimelineFilters;
export function pickYear(f: TimelineFilters, year: number | null): TimelineFilters;     // sets from/to to the year bounds
export function setPeriod(f: TimelineFilters, from: string | null, to: string | null): TimelineFilters; // clears year
export function toQuery(f: TimelineFilters): { type?: EventType[]; component?: Component[]; from?: string; to?: string };
export function activeCount(f: TimelineFilters): number;
// queryKeys.ts — nested under the existing prefix so current invalidations of qk.timeline(vin) refresh both:
timelinePages: (vin: string, f: TimelineFilters) => ['timeline', vin, 'pages', f] as const,
timelineSummary: (vin: string, f: TimelineFilters) => ['timeline', vin, 'summary', f] as const,
export function useTimelinePages(vin: string, f: TimelineFilters): UseInfiniteQueryResult<EventResponse[]>; // order=desc, limit 20
export function useTimelineSummary(vin: string, f: TimelineFilters): UseQueryResult<TimelineSummary>;
```

Screen layout and copy follow spec §8.3 and the sketch in it:
- `SectionList` grouped by year, with `onEndReached` paging. "Load more" is not needed: this is the decision on
  spec §11.
- `TimelineRail`:
  - a 2px `line`-token rail in a 24px gutter
  - a 10px dot tinted by `EVENT_TYPE_CONFIG[type].tint`
  - a 2px ring when `evidence` is `DOCUMENTED` or higher
  - the rail breaks at section headers
- Filters live in `useState` only; they are not persisted (decision on spec §11).
- Pull-to-refresh refetches both queries.

- [ ] **Step 1: Write the failing tests.**
  - `timelineFilters.test.ts`:
    - `pickYear sets bounds`
    - `setPeriod clears year`
    - `toQuery omits empty`
    - `activeCount`
  - `timeline-full.feature` + steps: all 9 scenarios from spec §10.3 ("Full timeline").
- [ ] **Step 2: Run** `npx jest test/steps/timeline-full.steps.tsx src/features/event/model/timelineFilters.test.ts`.
  Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run check`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(mobile): full timeline screen with rail, filters and summary`

### Task 17: Diagrams match the build

**Files:**
- Modify: `docs/diagrams/timeline-extended.puml`, `docs/diagrams/event-timeline.puml`

- [ ] **Step 1: Update the diagrams.**
  - `timeline-extended-components`, `-domain` and `-mobile` name the classes and files exactly as built:
    `validityEntries` instead of `currentValidityEntries`, `EventFacts`/`EventAnnotations`, `EventInputs`, `DETAILS_VIEW`.
  - `event-timeline.puml` `event-add-seq` gains `opt odometerKm present` around the neighbour/odometer calls.
- [ ] **Step 2: Render-check.** `java -jar plantuml.jar -checkonly docs/diagrams/*.puml`, if PlantUML is available.
  Otherwise paste each block into the PlantUML server preview. Expected: no syntax errors.
- [ ] **Step 3: Update the spec.** In `docs/superpowers/specs/2026-11-16-timeline-extended-design.md` §5.6 and §7,
  replace `currentValidityEntries` with `validityEntries` and add a note that the domain picks the current entries.
- [ ] **Step 4: Commit.** `docs: diagrams and spec match the extended timeline build`
