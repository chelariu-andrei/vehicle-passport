# Fuel & Cost per km: Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `fuel` feature: owners log fill-ups per car and read consumption, cost, price series, month estimate, grade comparison and a sudden-increase alert.

**Architecture:** A separate hexagonal feature (`com.vehiclepassport.server.fuel`) with its own table. All numbers are computed on read by pure domain calculators; nothing derived is stored. The only link to `event` is a one-way odometer check through `event`'s `port/in`.

**Tech Stack:** Quarkus, Hibernate/Panache, Flyway, JUnit 5, Cucumber (`quarkus-cucumber`), ArchUnit.

**Spec:** `docs/superpowers/specs/2026-11-17-fuel-cost-design.md`. Mobile plan: `2026-11-17-fuel-cost-mobile.md` (starts after Task 1 here).

## Global Constraints

- Contract first (`contracts/openapi.yaml`), then code. Rules in `.claude/rules/backend-architecture.md` apply: `domain` pure Java, `@Transactional` only in `application/service`, cross-feature only via `port/in`, applied migrations never edited.
- Next free Flyway number is **`V13`**: `V13__fuel_entry.sql`.
- Fuel entry types: `PETROL, DIESEL, LPG, ELECTRIC`. Unit `L` (liquid, LPG) or `KWH` (electric). Grade `STANDARD | PREMIUM` (not for ELECTRIC). Charge type `HOME | AC_PUBLIC | DC_FAST` (only ELECTRIC).
- Vehicle fuel compatibility: `PETROL/DIESEL/LPG` entries rejected on an `ELECTRIC` vehicle; `ELECTRIC` entries rejected on `PETROL/DIESEL/LPG` vehicles; anything allowed for `HYBRID` and `OTHER`. Code `invalid-fuel-entry` (422).
- Entry validation: `quantity > 0` (max 9999), `total >= 0` (max 999999), `odometerKm >= 0`, currency `^[A-Z]{3}$`, date not later than today + 1 day, `station` max 60, `note` max 200. `unit_price = total / quantity`, 4 decimals, HALF_UP.
- Consumption segment: full fill-up A to next full fill-up B of the same fuel type; quantity = sum of entries after A up to and including B; `km = B.km - A.km`; value = `quantity / km * 100`. Excluded when `km <= 0`, `km < 20`, or any entry in `(A, B]` has `missed_previous`. A `full_tank = false` entry never closes a segment. Average is weighted: `sum quantity / sum km * 100`. Sort order: `(entry_date, odometer_km, created_at)`.
- Alert: latest included segment `L`, up to the 5 included segments before it `P`; alert when `|P| >= 3` and `L > mean(P) * 1.15`. Config `fuel.alert.threshold-pct=15`, `fuel.alert.window=5`, `fuel.alert.min-baseline=3` through `@ConfigMapping FuelConfig`.
- Grade comparison: a segment has a grade only if every entry in `(A, B]` shares the same non-null grade; returned only when both grades have `>= 3` segments.
- Cost metrics: `costPerKm = sum total of entries after the first / (lastKm - firstKm)`, null with `< 2` entries or zero span. `monthEstimate.projected = (sum total, last 60 days) / 60 * days in current month`, null with `< 3` entries in the window. Stats period `3m | 6m | 12m | all`, default `6m`.
- Currency: stats use the currency with the most entries in the period; the rest are counted in `ignoredEntries`.
- Privacy: reads and writes filter on the active owner's current `period_id`. No fuel data in `Snapshot`/passport/PDF.
- List page: `limit` default 30, max 100, opaque `cursor`, newest first.
- Error codes: `fuel-entry-not-found` (404), `invalid-fuel-entry` (422), existing `odometer-inconsistent` (422), `validation-failed` (400), `vehicle-not-found` (404).

## Review Focus

- Editing or deleting an entry in the middle of the chain must change only the neighbouring segments (Task 3, Task 7).
- Two entries with the same date and km, or a first entry that is partial: no division by zero, no crash, deterministic order (Task 3).
- A car with no entries, or only one: stats answer 200 with nulls and empty arrays, never 404/500 (Task 6).
- Editing the km of a middle entry above the next entry's km is refused with `odometer-inconsistent` (Task 5).
- Entries in two currencies: stats stay consistent and report `ignoredEntries` (Task 6).

---

### Task 1: Contract

**Files:**
- Modify: `contracts/openapi.yaml` (new tag `fuel`, five operations, schemas from spec §6)
- Regenerate: `mobile/src/shared/api/generated/schema.d.ts` (`npm run gen:api` in `mobile/`)

**Interfaces:**
- Produces: operations `addFuelEntry`, `listFuelEntries`, `updateFuelEntry`, `deleteFuelEntry`, `getFuelStats`; schemas `FuelEntryType`, `FuelGrade`, `ChargeType`, `FuelEntryRequest`, `FuelEntryResponse`, `FuelEntryPage { items, nextCursor }`, `FuelStatsResponse` with exactly the fields in spec §6.

- [ ] **Step 1:** Add the paths and schemas, with responses `400/403 ConsentRequired/404/422` as on the event operations, and `additionalProperties: false` on the request.
- [ ] **Step 2:** Run `npm run gen:api` then `npm run typecheck` in `mobile/`. Expected: typecheck passes. `test/operations-covered.test.ts` will fail until the mobile plan consumes the five operations: that is expected, note it in the commit.
- [ ] **Step 3:** Commit `feat(contract): fuel entries and fuel stats`.

### Task 2: Domain model, validation, and ArchUnit registration

**Files:**
- Create under `server/src/main/java/com/vehiclepassport/server/fuel/domain/`: `model/FuelEntry.java`, `model/FuelEntryType.java`, `model/FuelGrade.java`, `model/ChargeType.java`, `model/FuelUnit.java`, `model/VehicleFuel.java`, `exception/InvalidFuelEntryException.java`, `exception/FuelEntryNotFoundException.java`
- Modify: `server/src/test/java/com/vehiclepassport/server/architecture/ArchitectureTest.java` (add `"fuel"` to `FEATURES`; add `BASE + ".fuel.."` to `shared_is_independent`)
- Test: `server/src/test/java/com/vehiclepassport/server/fuel/domain/model/FuelEntryTest.java`

**Interfaces:**
- Produces:
  - `enum FuelEntryType { PETROL, DIESEL, LPG, ELECTRIC; FuelUnit unit(); boolean allowedFor(VehicleFuel f) }`
  - `enum VehicleFuel { PETROL, DIESEL, HYBRID, ELECTRIC, LPG, OTHER }` (fuel's own copy of the vehicle fuel values; the domain imports nothing from `vehicle`)
  - `record FuelEntry(UUID id, String vin, UUID periodId, UUID createdBy, LocalDate date, int odometerKm, FuelEntryType fuelType, BigDecimal quantity, BigDecimal total, BigDecimal unitPrice, String currency, FuelGrade grade, ChargeType chargeType, String station, String note, boolean fullTank, boolean missedPrevious, Instant createdAt)` with static factory `FuelEntry.create(..., VehicleFuel vehicleFuel, LocalDate today)` that validates and computes `unitPrice`
  - `InvalidFuelEntryException(String detail)` extends `DomainException` with `ErrorKind.UNPROCESSABLE`, code `invalid-fuel-entry`; `FuelEntryNotFoundException` with `ErrorKind.NOT_FOUND`, code `fuel-entry-not-found` (check `ErrorKind` for the exact constant names).

- [ ] **Step 1:** Add the `ArchitectureTest` registration. Run `mvn -q test -Dtest=ArchitectureTest` in `server/`. Expected: PASS (nothing in `fuel` yet).
- [ ] **Step 2:** Write `FuelEntryTest` failing: `create_computes_unit_price_to_four_decimals` (300.00 / 40.0 -> 7.5000; 315.00 / 42.0 -> 7.5000; 312.00 / 38.2 -> 8.1675), `rejects_non_positive_quantity`, `rejects_negative_total`, `rejects_future_date_beyond_one_day`, `accepts_tomorrow`, `rejects_grade_on_electric`, `rejects_charge_type_on_liquid_fuel`, and a parameterised `fuel_type_vs_vehicle_fuel` over the full matrix of spec §5.1 (ELECTRIC car with DIESEL entry fails, DIESEL car with ELECTRIC fails, HYBRID accepts PETROL and ELECTRIC, OTHER accepts all).
- [ ] **Step 3:** Run `mvn -q test -Dtest=FuelEntryTest`. Expected: FAIL (classes missing).
- [ ] **Step 4:** Implement the types above in the listed files. Domain depends on `java.*` and `shared.error` only.
- [ ] **Step 5:** Run `mvn -q test -Dtest='FuelEntryTest,ArchitectureTest'`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(fuel): fuel entry domain model and validation`.

### Task 3: Consumption calculator

**Files:**
- Create: `fuel/domain/model/ConsumptionCalculator.java`, `fuel/domain/model/ConsumptionSegment.java`, `fuel/domain/model/ConsumptionResult.java`
- Test: `server/src/test/java/com/vehiclepassport/server/fuel/domain/model/ConsumptionCalculatorTest.java`

**Interfaces:**
- Consumes: `FuelEntry`.
- Produces:
  - `record ConsumptionSegment(UUID closingEntryId, LocalDate date, int odometerKm, BigDecimal quantity, int km, BigDecimal per100km, FuelGrade grade)`
  - `record ConsumptionResult(List<ConsumptionSegment> segments, BigDecimal average)` (average null with no segments; 2 decimals HALF_UP)
  - `final class ConsumptionCalculator { static ConsumptionResult calculate(List<FuelEntry> entriesOfOneFuelType) }`: sorts internally, so callers may pass any order.

- [ ] **Step 1:** Write failing tests with the spec's numbers: `two_full_tanks` (10000 km/40 L then 10600 km/42 L -> segment 7.00, average 7.00); `partial_in_between_counts_but_does_not_close` (40 L full, 20 L partial at 10300, 22 L full at 10600 -> quantity 42, 7.00, partial has no segment); `missed_previous_excludes_segment`; `first_full_only_opens`; `partial_first_entry_is_ignored_until_a_full_one`; `km_zero_or_negative_excluded` (same km twice); `under_20_km_excluded`; `unsorted_input_same_result`; `same_date_and_km_ordered_by_created_at`; `weighted_average_not_mean_of_means` (segments 6.0 over 100 km and 8.0 over 900 km -> 7.80); `electric_uses_kwh_quantity`; `segment_grade_only_when_all_entries_share_it`.
- [ ] **Step 2:** Run `mvn -q test -Dtest=ConsumptionCalculatorTest`. Expected: FAIL.
- [ ] **Step 3:** Implement `ConsumptionCalculator.calculate`: walk the sorted entries keeping the last full entry as anchor and an accumulator of quantity/missed flag/grade-set since the anchor; on a full entry, emit or discard a segment and re-anchor; a segment discarded for any reason still re-anchors at B.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): consumption segments and weighted average`.

### Task 4: Alert, grade comparison, cost metrics, config

**Files:**
- Create: `fuel/domain/model/ConsumptionAlert.java`, `GradeComparison.java`, `CostMetrics.java`, `MonthCost.java`, `MonthEstimate.java`; `fuel/application/FuelConfig.java` (`@ConfigMapping(prefix = "fuel")`, framework annotation is allowed in `application`; if the ArchUnit rule `application_is_framework_free` rejects `io.smallrye.config`, put it in `shared/config` like the existing configs); `src/main/resources/application.properties` entries
- Test: `ConsumptionAlertTest.java`, `GradeComparisonTest.java`, `CostMetricsTest.java` in `server/src/test/java/com/vehiclepassport/server/fuel/domain/model/`

**Interfaces:**
- Consumes: `ConsumptionSegment`, `FuelEntry`.
- Produces:
  - `record ConsumptionAlert(BigDecimal latest, BigDecimal baseline, BigDecimal deltaPct, UUID entryId)`; `static Optional<ConsumptionAlert> detect(List<ConsumptionSegment> chronological, int window, int minBaseline, BigDecimal thresholdPct)`
  - `record GradeComparison(FuelGrade grade, BigDecimal average, int segmentCount)`; `static List<GradeComparison> compare(List<ConsumptionSegment> segments, int minPerGrade)` (empty unless both grades reach the minimum, minimum 3)
  - `final class CostMetrics`: `static List<MonthCost> monthly(List<FuelEntry>)`, `static BigDecimal costPerKm(List<FuelEntry> sorted)` (null per spec), `static BigDecimal avgUnitPrice(List<FuelEntry>)`, `static MonthEstimate monthEstimate(List<FuelEntry>, LocalDate today)`; `record MonthCost(YearMonth month, BigDecimal cost, BigDecimal quantity, int entries, Integer distanceKm)`; `record MonthEstimate(YearMonth month, BigDecimal spentSoFar, BigDecimal projected)`.

- [ ] **Step 1:** Write failing tests: alert fires at `6.8,6.8,6.8,8.4` (8.40 vs baseline 6.80, delta 23.5%), does not fire with two baseline segments, does not fire at exactly +15.0%, fires just above it, ignores a decrease, uses only the last 5 baseline segments; grade comparison hidden at 2+3 segments and shown at 3+3; `costPerKm` over two entries (first entry's cost excluded), null with one entry and with zero span; `monthEstimate` null with 2 entries in 60 days, correct projection with 3 (`today` = 2026-11-17, 30-day month); `monthly` distance uses the previous month's last entry as anchor and is null without one.
- [ ] **Step 2:** Run `mvn -q test -Dtest='ConsumptionAlertTest,GradeComparisonTest,CostMetricsTest'`. Expected: FAIL.
- [ ] **Step 3:** Implement the types and static methods above, plus the three `fuel.alert.*` properties.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): alert, grade comparison and cost metrics`.

### Task 5: Application ports and entry service

**Files:**
- Create: `fuel/application/port/in/`: `AddFuelEntryUseCase`, `UpdateFuelEntryUseCase`, `DeleteFuelEntryUseCase`, `ListFuelEntriesUseCase`, `FuelEntryCommand`, `FuelEntryView`, `FuelEntryPage`; `fuel/application/port/out/`: `FuelEntryRepositoryPort`, `ActiveOwnerPort`, `OdometerCheckPort`, `VehicleFuelPort`, `ClockPort`; `fuel/application/service/FuelEntryService.java`
- Modify: `event/application/port/in/` add `LatestOdometerUseCase` (`Optional<Integer> latestKm(String vin)`) implemented by `EventService`; check `vehicle/application/port/in` for an existing use case that returns the vehicle's fuel and reuse it, otherwise add `GetVehicleFuelUseCase` (`String fuel(String vin)`)
- Test: `server/src/test/java/com/vehiclepassport/server/fuel/application/service/FuelEntryServiceTest.java` (with in-memory fakes of the ports, no Quarkus)

**Interfaces:**
- Produces:
  - `FuelEntryCommand(UUID userId, String vin, UUID entryId /*null on add*/, LocalDate date, int odometerKm, FuelEntryType fuelType, BigDecimal quantity, BigDecimal total, String currency, boolean fullTank, boolean missedPrevious, FuelGrade grade, ChargeType chargeType, String station, String note)`
  - `FuelEntryView` mirrors `FuelEntryResponse` including `unit` and `consumption` (null unless it closes an included segment)
  - `FuelEntryRepositoryPort`: `FuelEntry save(FuelEntry)`, `Optional<FuelEntry> find(String vin, UUID periodId, UUID id)`, `List<FuelEntry> all(String vin, UUID periodId)` (sorted per spec), `Page<FuelEntry> page(String vin, UUID periodId, String cursor, int limit)`, `void softDelete(UUID id, Instant at)`
  - `ActiveOwnerPort.assertActiveOwner(String vin, UUID userId) -> OwnedPeriod(vin, periodId)` (404 `vehicle-not-found` for non-owners, same behaviour as `event`)
  - `OdometerCheckPort.isConsistent(String vin, LocalDate date, int km)`; `VehicleFuelPort.fuelOf(String vin) -> VehicleFuel`; `ClockPort.today()`.

- [ ] **Step 1:** Write failing `FuelEntryServiceTest`: `add_saves_and_returns_view_with_unit_price`; `non_owner_gets_vehicle_not_found`; `odometer_below_previous_entry_is_refused` (previous 10000, new 9900 -> `OdometerInconsistentException`-equivalent code `odometer-inconsistent`); `odometer_above_next_entry_is_refused`; `odometer_below_recorded_event_is_refused` (fake `OdometerCheckPort` returns false); `update_rechecks_odometer_against_neighbours_excluding_itself`; `update_middle_entry_above_next_is_refused`; `delete_is_soft_and_idempotent_for_unknown_id_is_404`; `electric_on_diesel_vehicle_is_refused`. fuel needs its own `OdometerInconsistentException` in `fuel/domain/exception` (code `odometer-inconsistent`, `ErrorKind.UNPROCESSABLE`), because the domain must not import `event.domain`.
- [ ] **Step 2:** Run `mvn -q test -Dtest=FuelEntryServiceTest`. Expected: FAIL.
- [ ] **Step 3:** Implement the ports and `FuelEntryService` (`@ApplicationScoped`, `@Transactional` on writes). Neighbour check: load `all(vin, periodId)`, drop the entry being edited, find previous/next by sort order, apply a domain `OdometerPolicy.check(previousKm, km, nextKm)` copy placed in `fuel/domain/model/OdometerPolicy.java`. Add `LatestOdometerUseCase` to `event` with its own small test in the existing `EventServiceTest`.
- [ ] **Step 4:** Run `mvn -q test -Dtest='FuelEntryServiceTest,EventServiceTest'`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): add, update, delete and list fuel entries`.

### Task 6: Stats service

**Files:**
- Create: `fuel/application/port/in/GetFuelStatsUseCase.java`, `FuelStatsView.java`, `fuel/application/service/FuelStatsService.java`
- Test: `server/src/test/java/com/vehiclepassport/server/fuel/application/service/FuelStatsServiceTest.java`

**Interfaces:**
- Consumes: `FuelEntryRepositoryPort.all`, `ActiveOwnerPort`, `ClockPort`, `LatestOdometerUseCase` (through a new `LatestOdometerPort` in `port/out`, adapter in Task 7), `ConsumptionCalculator`, `ConsumptionAlert`, `GradeComparison`, `CostMetrics`, `FuelConfig`.
- Produces: `GetFuelStatsUseCase.stats(UUID userId, String vin, String period) -> FuelStatsView` where `FuelStatsView` has every field of spec §6 `FuelStatsResponse` plus `ignoredEntries`; per-fuel-type `points` list with `consumption` set on closing entries.

- [ ] **Step 1:** Write failing tests: `empty_car_returns_empty_structures_and_nulls` (200-shaped view, `lastOdometerKm` null, `byFuelType` empty, `monthEstimate.projected` null); `single_entry_has_no_consumption_and_no_cost_per_km`; `period_3m_excludes_older_entries`; `period_all_includes_everything`; `last_odometer_is_max_of_events_and_fuel`; `two_fuel_types_are_separate_blocks`; `mixed_currencies_use_the_most_frequent_and_count_the_rest`; `unknown_period_is_validation_failed` (400 `validation-failed`).
- [ ] **Step 2:** Run `mvn -q test -Dtest=FuelStatsServiceTest`. Expected: FAIL.
- [ ] **Step 3:** Implement `FuelStatsService` (`@ApplicationScoped`, no `@Transactional` needed beyond read; use `@Transactional` only if the repository port requires it). Load once, filter by period and currency, group by fuel type, run the calculators.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): fuel statistics`.

### Task 7: Persistence and outbound adapters

**Files:**
- Create: `server/src/main/resources/db/migration/V13__fuel_entry.sql` (exact DDL from spec §4); `fuel/infrastructure/persistence/entity/FuelEntryEntity.java`; `fuel/infrastructure/persistence/repository/FuelEntryPanacheRepository.java` (implements `FuelEntryRepositoryPort`); `fuel/infrastructure/client/EventFeatureAdapter.java` (`OdometerCheckPort` -> `event.CheckOdometerUseCase`, `LatestOdometerPort` -> `event.LatestOdometerUseCase`), `VehicleFeatureAdapter.java` (`VehicleFuelPort`), `VehicleOwnerAdapter.java` (`ActiveOwnerPort` -> `vehicle.AssertActiveOwnerUseCase`, same shape as `event`'s adapter)
- Test: `server/src/integration-test/java/com/vehiclepassport/server/fuel/FuelPersistenceIT.java` (same style as `EventPersistenceIT`)

**Interfaces:**
- Consumes: ports from Tasks 5 and 6.
- Produces: working persistence; cursor is the base64 of `entry_date|odometer_km|id` of the last returned row; a malformed cursor throws `InvalidFuelEntryException.validation` (`validation-failed`, 400).

- [ ] **Step 1:** Write failing `FuelPersistenceIT`: `migration_creates_table_and_index`; `save_and_find_roundtrip_keeps_decimals` (quantity 38.200, unit price 8.1675); `all_returns_sorted_and_excludes_soft_deleted`; `entries_of_other_period_are_invisible`; `page_walks_newest_first_by_cursor_without_duplicates`; `bad_cursor_is_validation_failed`.
- [ ] **Step 2:** Run `mvn -q verify -Dit.test=FuelPersistenceIT` (use the project's usual IT invocation; check `server/pom.xml` surefire/failsafe setup). Expected: FAIL.
- [ ] **Step 3:** Write the migration, entity (`*Entity`, under `infrastructure/persistence/entity`) and repository mapping entity <-> domain; write the three adapters.
- [ ] **Step 4:** Run the IT again. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): persistence and adapters`.

### Task 8: REST API

**Files:**
- Create: `fuel/api/FuelResource.java` (`@Path("/vehicles/{vin}/fuel-entries")`), `fuel/api/FuelStatsResource.java` (`@Path("/vehicles/{vin}/fuel/stats")`), `fuel/api/dto/FuelEntryRequest.java`, `FuelEntryResponse.java`, `FuelEntryPageResponse.java`, `FuelStatsResponse.java`, `fuel/api/mapper/FuelDtoMapper.java`
- Test: `server/src/integration-test/java/com/vehiclepassport/server/fuel/FuelResourceIT.java` (same style as `EventResourceIT`)

**Interfaces:**
- Consumes: the five use cases. `CurrentUser` for the caller, exactly as `EventResource`.
- Produces: HTTP behaviour of spec §6. Request DTO uses Bean Validation (`@NotNull`, `@DecimalMin`, `@DecimalMax`, `@Pattern`, `@Size`) and rejects unknown fields (same mechanism the event DTOs use).

- [ ] **Step 1:** Write failing `FuelResourceIT`: `post_returns_201_with_unit_and_unit_price`; `post_unknown_field_is_400_validation_failed`; `post_without_consent_is_403_consent_required`; `post_electric_on_diesel_is_422_invalid_fuel_entry`; `post_low_km_is_422_odometer_inconsistent`; `put_replaces_and_returns_200`; `delete_returns_204_then_404`; `get_list_paginates`; `get_stats_defaults_to_6m`; `get_stats_bad_period_is_400`; `other_owner_gets_404_vehicle_not_found`; response bodies are `application/problem+json` on errors.
- [ ] **Step 2:** Run `mvn -q verify -Dit.test=FuelResourceIT`. Expected: FAIL.
- [ ] **Step 3:** Implement resources, DTOs and mapper. Resources stay thin (validate, map, call use case, map back).
- [ ] **Step 4:** Run the IT. Expected: PASS. Also run the existing contract/DTO consistency test (check `server/src/test/.../shared` for the OpenAPI comparison test) and add the new schemas.
- [ ] **Step 5:** Commit `feat(fuel): REST endpoints`.

### Task 9: Cucumber behaviour

**Files:**
- Create: `server/src/integration-test/resources/features/fuel/fuel_entries.feature`, `consumption.feature`, `fuel_stats.feature`; `server/src/integration-test/java/com/vehiclepassport/server/fuel/steps/FuelSteps.java`, `FuelStatsSteps.java`; `testsupport/fake/FakeFuelEntryRepository.java` (implements `FuelEntryRepositoryPort`, registered the same way as `FakeEventRepository`, and cleared by `Hooks` via `Resettable`)

**Interfaces:**
- Consumes: use cases from Tasks 5 and 6, `World`, `TestClock`, existing vehicle/event steps (`I own vehicle V ...` lives in the event steps; reuse it and add the `with fuel DIESEL` variant in `FuelSteps` only if the existing step has no fuel parameter).
- Produces: scenarios from spec §9.1, all green.

- [ ] **Step 1:** Write the features: the five consumption scenarios in the spec verbatim, plus `fuel_entries` (odometer below previous, odometer below a recorded service, electric on DIESEL, grade on electric, HYBRID accepts PETROL and ELECTRIC, edit re-checks odometer, delete removes from stats, cursor pagination, bad cursor) and `fuel_stats` (monthly cost, cost per km, month estimate null under 3 entries, grade comparison hidden at 2 tanks and shown at 3, mixed currencies `ignoredEntries`).
- [ ] **Step 2:** Run `mvn -q verify -Dit.test=BehaviourIT`. Expected: FAIL with undefined steps.
- [ ] **Step 3:** Implement the steps (table steps build entries through `AddFuelEntryUseCase`, assertions read `FuelStatsView`), and the fake repository.
- [ ] **Step 4:** Run `BehaviourIT`. Expected: PASS for the fuel features and no regression elsewhere.
- [ ] **Step 5:** Commit `test(fuel): cucumber scenarios`.

### Task 10: Privacy, purge, export

**Files:**
- Create: `fuel/application/port/in/DetachOwnerUseCase.java` (delete the person's rows; signature `void detach(UUID ownerId, UUID tombstone)`), `ListFuelEntriesByCreatorUseCase.java` (`List<FuelEntryExportView> listByCreator(UUID userId)`); implement in a small `fuel/application/service/FuelOwnerService.java`; add the matching repository port methods and implementation
- Modify: `account/infrastructure/adapter/OwnerDataEraserAdapter.java` (call `fuel.detach` in `detachOwnedData`), `account/infrastructure/adapter/OwnerDataExportAdapter.java` (add `fuelEntries` to the export), `contracts/openapi.yaml` export schema if it lists sections (check `/me/export`)
- Create: `server/src/integration-test/resources/features/fuel/fuel_privacy.feature` and steps

**Interfaces:**
- Consumes: Task 5 ports. Produces: the account hooks.

- [ ] **Step 1:** Write the failing `fuel_privacy.feature`: another owner's car -> 404; after a transfer the new owner lists no entries; account deletion removes entries; the data export contains them; a passport created after fill-ups has none of their data (assert on the `Snapshot` content).
- [ ] **Step 2:** Run `BehaviourIT`. Expected: FAIL.
- [ ] **Step 3:** Implement the two use cases and wire the adapters.
- [ ] **Step 4:** Run `BehaviourIT` and the existing account/export tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): purge and export hooks`.

### Task 11: ArchUnit rules and final verification

**Files:**
- Modify: `server/src/test/java/com/vehiclepassport/server/architecture/ArchitectureTest.java`

**Interfaces:**
- Produces: four rules from spec §9.2 as `@ArchTest static final ArchRule`: `fuel_domain_has_no_event_or_vehicle_dependency`, `event_does_not_depend_on_fuel`, `fuel_calculators_are_pure` (no `jakarta..`, `io.quarkus..`, `..port..`; no non-static non-final fields), `fuel_ports_out_are_implemented_in_infrastructure`.

- [ ] **Step 1:** Add the four rules. Run `mvn -q test -Dtest=ArchitectureTest`. Expected: PASS (all the code exists now). Then temporarily add an `event` -> `fuel` import and confirm `event_does_not_depend_on_fuel` FAILS; revert it.
- [ ] **Step 2:** Run the full suite `mvn -q verify` in `server/`. Expected: all green.
- [ ] **Step 3:** Commit `test(fuel): architecture rules for the fuel feature`.

---

## Self-review

- **Spec coverage:** data model and migration (Task 7), validation (2), consumption (3), alert/grade/cost/estimate (4), endpoints and errors (8), stats and currency (6), odometer rule and one-way link (5, 11), privacy/purge/export/passport (10), Cucumber (9, 10), ArchUnit (2, 11), contract (1). Spec §10 open questions are decided in Global Constraints with the spec's proposed defaults; changing them touches only Task 4 config and Task 6 defaults.
- **Types:** `FuelEntry`, `ConsumptionSegment`, `FuelStatsView` names are used identically across tasks 3 to 10.
- **Proportion:** each task carries its tests and signatures; bodies are left to the implementer except the segment walk, which is described in Task 3.
