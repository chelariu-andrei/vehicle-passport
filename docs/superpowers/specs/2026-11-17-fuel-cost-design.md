# Fuel & cost per km: backend and contract

Date: 2026-11-17 · Scope: `contracts/`, `server/` (new feature `fuel`) · Status: draft for approval
Mobile UI: `2026-11-17-fuel-cost-mobile-design.md`.

## 1. Intent

The owner logs a fill-up in about 10 seconds and gets back what the car really costs to run: real consumption, cost per
month, cost per km, and an early warning when consumption jumps. Fuel entries are **private working data**, not part of
the car's documented history.

## 2. Goals / Non-goals

**Goals**
- Create, edit, delete, list fuel entries per car (petrol, diesel, LPG, electric).
- Server-side statistics: consumption between full fill-ups, monthly cost, cost per km, price series, month estimate,
  premium vs standard comparison, sudden-increase alert.
- Each entry carries an odometer reading and is checked against the car's recorded history.

**Non-goals (this spec)**
- **Receipt scanning / OCR for fuel.** Fuel is manual. The existing scan pipeline is untouched.
- Total cost of ownership (fuel + maintenance + insurance + taxes). Planned next as a read-only
  `GET /vehicles/{vin}/cost-summary` that reuses the stats here and `event` costs. Not designed here.
- Fuel entries in the timeline, in passports, or in the PDF. They are not evidence and stay private.
- Push notifications for the alert (the alert is returned in stats; mobile shows it in-app).
- Currency conversion. One currency per entry; stats group by currency (see §6).

## 3. Decisions and my calls

1. **Separate feature `fuel`, own table.** Not an `event` type: hundreds of fill-ups would drown the timeline and the
   passport, and fuel has no evidence level, documents or validity. Same hexagonal layout as `event`.
2. **Odometer link is one-way.** `fuel` asks `event` through `CheckOdometerUseCase` (existing, same pattern as
   `scan/.../EventFeatureAdapter`) and also checks its own neighbours. `event` does **not** look at fuel readings.
   Known gap: a service event dated before a fill-up can carry a lower km than that fill-up without error. Closing it
   needs a shared odometer store; deferred until it hurts. "Latest known km" for prefill is
   `max(event km, fuel km)`, computed in stats.
3. **Quantity + total are stored; unit price is derived** (`total / quantity`, 4 decimals). The pump rounds the total, so
   the user's total is kept as typed. The "any two of three" input is a mobile convenience (see mobile spec).
4. **Consumption is computed on read, never stored.** Edits and deletes then cannot leave stale numbers. Volume is small
   (a car has a few hundred entries a year at most).
5. **Premium/standard is a free tag**, not a price tier. It only feeds a comparison once there is enough data.
6. **Private to the owner.** Entries belong to the ownership period they were created in. The next owner never sees
   them. Details in §8.

## 4. Data model

Migration `V13__fuel_entry.sql`:

```sql
create table vehicle_passport.fuel_entry (
    id               uuid primary key,
    vin              varchar(17)    not null references vehicle_passport.vehicle (vin),
    period_id        uuid           not null references vehicle_passport.ownership_period (id),
    created_by       uuid           not null,
    entry_date       date           not null,
    odometer_km      integer        not null check (odometer_km >= 0),
    fuel_type        varchar(20)    not null,           -- PETROL | DIESEL | LPG | ELECTRIC
    quantity         numeric(9, 3)  not null check (quantity > 0),   -- litres, or kWh for ELECTRIC
    total            numeric(12, 2) not null check (total >= 0),
    unit_price       numeric(10, 4) not null,           -- derived, stored for the price series
    currency         varchar(3)     not null,
    grade            varchar(10),                       -- STANDARD | PREMIUM, not for ELECTRIC
    charge_type      varchar(10),                       -- HOME | AC_PUBLIC | DC_FAST, only ELECTRIC
    station          varchar(60),
    note             varchar(200),
    full_tank        boolean        not null default true,
    missed_previous  boolean        not null default false,
    created_at       timestamptz    not null,
    updated_at       timestamptz    not null,
    deleted_at       timestamptz
);

create index fuel_entry_by_vin_date
    on vehicle_passport.fuel_entry (vin, period_id, entry_date, odometer_km, id) where deleted_at is null;
```

Notes: `grade` and `charge_type` are mutually exclusive by fuel type (§5.2). `fuel_type` values are the physical fuel,
a subset of the vehicle's `FuelType`. A `HYBRID` car may log `PETROL` or `ELECTRIC`.

## 5. Domain rules

### 5.1 Entry validation (`domain/model/FuelEntry`)
- `quantity > 0`, `total >= 0`, `odometerKm >= 0`, date not in the future (device-local date + 1 day tolerance).
- `fuelType` must be physically possible for the vehicle: `PETROL/DIESEL/LPG` rejected on a vehicle with fuel
  `ELECTRIC`; `ELECTRIC` rejected on `PETROL/DIESEL/LPG`; anything goes for `HYBRID` and `OTHER`. Code
  `invalid-fuel-entry`.
- `grade` only when `fuelType != ELECTRIC`; `chargeType` only when `fuelType == ELECTRIC`. Code `invalid-fuel-entry`.
- Odometer: `previousKm <= km <= nextKm` among the car's own non-deleted entries in the current period
  (`OdometerPolicy.check` reused through a small copy in `fuel/domain`, the `event` domain is not imported), **and**
  `CheckOdometerUseCase.isConsistent(vin, date, km)`. Failure answers 422 `odometer-inconsistent` (existing code).

### 5.2 Consumption segments (`domain/model/ConsumptionCalculator`)
Per fuel type, entries sorted by `(entry_date, odometer_km, created_at)`.

- A **segment** runs from one full fill-up `A` to the next full fill-up `B` of the same fuel type.
- `segment.quantity` = sum of `quantity` of every entry **after** `A` up to and **including** `B` (partial fill-ups in
  between count; `A`'s own quantity belongs to the previous segment).
- `segment.km = B.km - A.km`; `consumption = quantity / km * 100` (L/100 km, or kWh/100 km for ELECTRIC).
- A segment is **excluded** (kept out of every average, chart and alert) when: `km <= 0`, any entry in `(A, B]` has
  `missed_previous = true`, or `km < 20` (noise).
- A `full_tank = false` entry never closes a segment. The first full fill-up only opens one.
- **Average** is weighted: `Σ quantity / Σ km * 100` over included segments, not a mean of means.
- **Last** is the consumption of the most recent included segment.

### 5.3 Alert (`domain/model/ConsumptionAlert`)
Per fuel type. Let `L` be the latest included segment and `P` the up to five included segments before it.
Alert when `|P| >= 3` and `L > mean(P) * 1.15`. Output: latest, baseline, `deltaPct`, `segmentEntryId`. The 15 % and the
window live in `@ConfigMapping FuelConfig` (`fuel.alert.threshold-pct`, `fuel.alert.window`). Never fires on a decrease.

### 5.4 Grade comparison
A segment has grade `G` only when **all** entries in `(A, B]` share the same non-null grade. Mixed or untagged segments
are skipped for this comparison. Returned only when both `STANDARD` and `PREMIUM` have at least 3 segments.

### 5.5 Cost metrics (all entries of the period, currency-grouped)
- `monthly[]`: `Σ total`, `Σ quantity`, entry count per calendar month (entry date). `distanceKm` per month is
  `maxKm - minKm` within the month using the month's entries plus the last entry of the previous month as the anchor
  (null if no anchor or only one reading).
- `costPerKm`: `Σ total of entries after the first` / `(lastKm - firstKm)` over the selected period. Null if fewer than
  2 entries or zero span. (The first fill-up pays for km driven before the window.)
- `avgUnitPrice`: `Σ total / Σ quantity` over the period, per fuel type.
- `monthEstimate`: `projected = (Σ total of last 60 days) / 60 * daysInCurrentMonth`; null with fewer than 3 entries in
  the window. `spentSoFar` is the real total of the current month.

## 6. HTTP API (contract-first: edit `contracts/openapi.yaml` before code)

New tag `fuel`. All routes: bearer JWT, consent required (`403 consent-required`), 404 `vehicle-not-found` for a car the
caller does not actively own. Every error is `application/problem+json`.

| Method | Path | operationId | Notes |
| --- | --- | --- | --- |
| POST | `/vehicles/{vin}/fuel-entries` | `addFuelEntry` | 201 `FuelEntryResponse` |
| GET | `/vehicles/{vin}/fuel-entries` | `listFuelEntries` | cursor page, newest first |
| PUT | `/vehicles/{vin}/fuel-entries/{entryId}` | `updateFuelEntry` | full replace, 200 |
| DELETE | `/vehicles/{vin}/fuel-entries/{entryId}` | `deleteFuelEntry` | soft delete, 204 |
| GET | `/vehicles/{vin}/fuel/stats` | `getFuelStats` | `?period=3m\|6m\|12m\|all` (default `6m`) |

Errors: `400 validation-failed`, `404 fuel-entry-not-found`, `422` with `odometer-inconsistent` or
`invalid-fuel-entry`. `GET` list takes `limit` (default 30, max 100) and opaque `cursor`; a bad cursor is
400 `validation-failed`.

### Schemas

```yaml
FuelEntryType:   { type: string, enum: [PETROL, DIESEL, LPG, ELECTRIC] }
FuelGrade:       { type: string, enum: [STANDARD, PREMIUM] }
ChargeType:      { type: string, enum: [HOME, AC_PUBLIC, DC_FAST] }

FuelEntryRequest:
  type: object
  additionalProperties: false
  required: [date, odometerKm, fuelType, quantity, total, currency]
  properties:
    date:       { type: string, format: date }
    odometerKm: { type: integer, minimum: 0 }
    fuelType:   { $ref: '#/components/schemas/FuelEntryType' }
    quantity:   { type: number, exclusiveMinimum: 0, maximum: 9999 }     # L or kWh
    total:      { type: number, minimum: 0, maximum: 999999 }
    currency:   { type: string, pattern: '^[A-Z]{3}$' }
    fullTank:        { type: boolean, default: true }
    missedPrevious:  { type: boolean, default: false }
    grade:      { $ref: '#/components/schemas/FuelGrade' }
    chargeType: { $ref: '#/components/schemas/ChargeType' }
    station:    { type: string, maxLength: 60 }
    note:       { type: string, maxLength: 200 }

FuelEntryResponse:
  required: [id, date, odometerKm, fuelType, quantity, unit, total, unitPrice, currency, fullTank, missedPrevious]
  properties:
    id: { type: string, format: uuid }
    # ...request fields...
    unit:      { type: string, enum: [L, KWH], readOnly: true }
    unitPrice: { type: number, readOnly: true }
    consumption:
      readOnly: true
      description: Per 100 km, set on the full fill-up that closes an included segment; otherwise null.
      type: [number, 'null']
```

`FuelStatsResponse`:

```yaml
required: [currency, period, lastOdometerKm, entryCount, monthly, monthEstimate, byFuelType]
properties:
  currency:        { type: string }          # the currency with most entries in the period; see below
  period:          { from: date|null, to: date|null }
  lastOdometerKm:  { type: [integer, 'null'] }     # max(event km, fuel km)
  entryCount:      integer
  totalCost:       number
  costPerKm:       { type: [number, 'null'] }
  monthly:         [ { month: 'YYYY-MM', cost, quantity, entries, distanceKm|null } ]
  monthEstimate:   { month: 'YYYY-MM', spentSoFar, projected|null }
  byFuelType:
    - fuelType, unit: L|KWH
      avgConsumption|null, lastConsumption|null, avgUnitPrice|null, segmentCount
      points: [ { entryId, date, odometerKm, unitPrice, consumption|null } ]   # every entry, chronological
      alert: { latest, baseline, deltaPct, entryId } | null
      gradeComparison: [ { grade, avgConsumption, segmentCount } ]              # empty unless §5.4 holds
```

**Currency.** v1 assumes one currency per car. If entries in the period use more than one, stats are computed over the
entries of the most frequent currency and the response also carries `ignoredEntries` (count). The mobile form defaults
to the currency of the last entry, so this stays an edge case.

`odometerKm` of an entry is also what other clients may show as a "reading"; there is no separate readings endpoint.

## 7. Backend structure (`com.vehiclepassport.server.fuel`)

```
fuel/
├── api/        FuelResource, FuelStatsResource, dto/ (FuelEntryRequest, FuelEntryResponse, FuelStatsResponse, ...),
│               mapper/FuelDtoMapper
├── application/
│   ├── port/in/   AddFuelEntryUseCase, UpdateFuelEntryUseCase, DeleteFuelEntryUseCase,
│   │              ListFuelEntriesUseCase, GetFuelStatsUseCase,
│   │              DetachOwnerUseCase (account purge), ListFuelEntriesByCreatorUseCase (export)
│   ├── port/out/  FuelEntryRepositoryPort, ActiveOwnerPort, OdometerCheckPort, VehicleFuelPort, ClockPort
│   └── service/   FuelEntryService, FuelStatsService
├── domain/
│   ├── model/     FuelEntry, FuelEntryType, FuelGrade, ChargeType, ConsumptionCalculator,
│   │              ConsumptionAlert, CostMetrics (all pure)
│   └── exception/ FuelEntryNotFoundException, InvalidFuelEntryException
└── infrastructure/
    ├── persistence/entity/FuelEntryEntity, persistence/repository/FuelEntryPanacheRepository
    └── client/    EventFeatureAdapter (OdometerCheckPort -> event.CheckOdometerUseCase, plus latest event km),
                   VehicleFeatureAdapter (VehicleFuelPort -> vehicle's fuel), OwnerAdapter (ActiveOwnerPort)
```

- `fuel` reads the vehicle's fuel and active ownership only through those `port/in` of `vehicle`. If a use case is
  missing there (vehicle fuel lookup, latest event km), add a narrow one in the owning feature. Never import its domain
  or entities.
- Error mapping stays in `shared/error`; add `fuel-entry-not-found` (404) and `invalid-fuel-entry` (422).
- Stats: load the period's entries once, run pure calculators. No SQL aggregation (keeps the maths unit-testable).

## 8. Privacy, ownership, account

- Entries store `period_id`. All reads filter on the **current** period of an **active owner**. After a release or
  transfer the new owner sees none, and the previous owner's access ends with their ownership.
- **Account purge:** `fuel.DetachOwnerUseCase.detach(ownerId, tombstone)` deletes the person's entries outright
  (they are personal usage data, no technical value). Hook it in `OwnerDataEraserAdapter` next to the existing three.
- **Export** (`/me/export`): include `fuelEntries` via `ListFuelEntriesByCreatorUseCase`, in `OwnerDataExportAdapter`.
- Entries are never included in `Snapshot` (passport) or the public PDF.
- `station` and `note` are free text from the owner: shown only to the owner, escaped by the clients.

## 9. Testing

- **Unit (`src/test`)**, the bulk: `ConsumptionCalculator` (two full fills; partial in between; `missed_previous`
  excludes; first full only opens; km <= 0; duplicate km; unsorted input; electric), `ConsumptionAlert` (needs 3
  baseline segments; exactly 15 %; decrease; excluded segments ignored), `CostMetrics` (month anchor, estimate window,
  single entry, mixed currencies), grade comparison threshold, `FuelEntry` validation matrix (fuel type vs vehicle fuel,
  grade vs charge type), cursor encoding.
- **Service tests** with port fakes: odometer 422 from neighbours and from the event check; non-owner 404; edit
  re-checks odometer; delete of a middle entry changes next segment.
- **Integration (`src/integration-test`)**: `FuelResourceIT` and `FuelPersistenceIT` (same shape as `EventResourceIT` /
  `EventPersistenceIT`): CRUD through HTTP, Flyway `V13`, consent gate, cross-owner 404, purge removes rows, export
  contains entries. Behaviour is covered by Cucumber (§9.1); the ITs cover only what Gherkin does not (SQL, migration,
  HTTP error shapes).
- Contract: `openapi.yaml` lints; DTOs match it (existing contract test, add the new schemas).

### 9.1 Cucumber (behaviour, `src/integration-test`)

Same setup as today: `BehaviourIT` (`@CucumberOptions(features = "classpath:features", glue = "com.vehiclepassport.server")`),
`World` and `Hooks` for state reset, in-memory fakes from `testsupport/fake`. Additions:

- Features in `src/integration-test/resources/features/fuel/`: `fuel_entries.feature`, `consumption.feature`,
  `fuel_stats.feature`, `fuel_privacy.feature`.
- Steps in `src/integration-test/java/com/vehiclepassport/server/fuel/steps/` (`FuelSteps`, `FuelStatsSteps`).
- `testsupport/fake/FakeFuelEntryRepository` (implements `FuelEntryRepositoryPort`), registered with `Resettable`
  like the others. The `event` odometer check uses the real `CheckOdometerUseCase` over `FakeEventRepository`.
- `TestClock` drives "today", so month estimates and the 60-day window are deterministic.
- Steps build fill-ups with a compact table so scenarios stay readable:

```gherkin
Feature: Fuel consumption

  Background:
    Given today is 2026-11-17
    And I own vehicle V with fuel DIESEL

  Scenario: Consumption is computed between two full tanks
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  |
    When I request the fuel stats of V
    Then the DIESEL average consumption is 7.00
    And the fill-up of 2026-10-20 has consumption 7.00

  Scenario: A partial fill-up counts in the segment but does not close it
    Given V has these fill-ups
      | date       | km    | quantity | total  | full |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  |
      | 2026-10-10 | 10300 | 20.0     | 150.00 | no   |
      | 2026-10-20 | 10600 | 22.0     | 165.00 | yes  |
    When I request the fuel stats of V
    Then the DIESEL average consumption is 7.00
    And the fill-up of 2026-10-10 has no consumption

  Scenario: A missed fill-up excludes the segment
    Given V has these fill-ups
      | date       | km    | quantity | total  | full | missed |
      | 2026-10-01 | 10000 | 40.0     | 300.00 | yes  | no     |
      | 2026-10-20 | 10600 | 42.0     | 315.00 | yes  | yes    |
    When I request the fuel stats of V
    Then the DIESEL average consumption is not available

  Scenario: A sudden increase raises an alert
    Given V has four consecutive full tanks at 6.8 L/100 km
    And V then has a full tank at 8.4 L/100 km
    When I request the fuel stats of V
    Then the DIESEL alert shows 8.40 against a baseline of 6.80

  Scenario: Three baseline tanks are needed before alerting
    Given V has two consecutive full tanks at 6.8 L/100 km
    And V then has a full tank at 9.5 L/100 km
    When I request the fuel stats of V
    Then there is no DIESEL alert
```

`fuel_entries.feature` scenarios: add a fill-up (derived unit price 8.1667 stored), odometer below the previous
fill-up → 422 `odometer-inconsistent`, odometer below a recorded service → 422, electric fuel on a DIESEL car →
422 `invalid-fuel-entry`, grade on an electric entry → 422, `HYBRID` car accepts PETROL and ELECTRIC, editing an entry
re-runs the odometer check, deleting an entry removes it from stats, list pagination by cursor, bad cursor → 400.
`fuel_stats.feature`: monthly cost, cost per km, month estimate (null under 3 entries in 60 days), premium vs
standard comparison hidden under 3 tanks each and shown at 3, mixed currencies report `ignoredEntries`.
`fuel_privacy.feature`: another owner's car → 404, after a transfer the new owner lists no entries, account deletion
purges entries, the data export contains them, a passport created after fill-ups contains none.

### 9.2 ArchUnit (`src/test/java/.../architecture/ArchitectureTest`)

The existing suite already enforces the hexagonal rules, so the `fuel` feature is held to them by registering it:

- Add `"fuel"` to `FEATURES` (otherwise `featureOf` returns null and every cross-feature rule silently skips it). Add
  `BASE + ".fuel.."` to `shared_is_independent`.
- That alone makes these rules apply to `fuel`: `domain_is_pure` (so the `OdometerPolicy` copy lives in `fuel/domain`
  and `fuel` never imports `event.domain`), `application_is_framework_free`, `api_does_not_reach_infrastructure`,
  `nothing_depends_on_infrastructure`, `cross_feature_only_via_port_in`, `naming`, `transactional_only_in_services`,
  `dtos_stay_in_api`, `dtos_do_not_use_domain`.
- **New rules for this feature** (each a small `@ArchTest`):
  - `fuel_domain_has_no_event_or_vehicle_dependency`: nothing in `..fuel.domain..` depends on `..event..` or
    `..vehicle..` (guards decision 2 and keeps the calculators pure and reusable).
  - `event_does_not_depend_on_fuel`: nothing in `..event..` depends on `..fuel..`. Makes the one-way odometer link
    (decision 3.2) a checked fact, not a convention. Remove this rule on purpose if the odometer gap is ever closed.
  - `fuel_calculators_are_pure`: classes `ConsumptionCalculator`, `ConsumptionAlert`, `CostMetrics` have no
    dependency on `jakarta..`, `io.quarkus..` or any `..port..` package, and carry no state (no non-static, non-final
    fields).
  - `fuel_ports_out_are_implemented_in_infrastructure`: every `fuel.application.port.out` interface has at least one
    implementation, and it lives in `..fuel.infrastructure..`.
- Violations fail `mvn test` (they run in the unit phase, not the integration phase), so a bad import breaks the build
  before the Cucumber suite starts.

## 10. Open questions for the owner

0. **Test scope**: Cucumber for behaviour plus ArchUnit for structure as in §9.1 and §9.2. The "event must not depend
   on fuel" rule (§9.2) is deliberate and tied to question 1.

1. **Odometer gap** (decision 2): accept one-way checking for v1?
2. **Threshold 15 % / window 5 / minimum 3 baseline segments**: good starting values or tune?
3. **Default period for stats** `6m` or `12m`?
4. **LPG on petrol cars** (bi-fuel conversions) is allowed by §5.1 only because the vehicle fuel is `PETROL`/`LPG`
   wide open. Keep it open, or tie to a "bi-fuel" flag later?
