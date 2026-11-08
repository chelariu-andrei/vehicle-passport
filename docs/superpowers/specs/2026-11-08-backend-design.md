# Backend design — vehicle-passport (v1)

Date: 2026-11-08 · Scope: `server/` only · Status: draft for approval

## 1. Intent

Vehicle history belongs to the **machine (VIN)**, not the user. An owner builds a trustworthy
history of their car (manually or by scanning service invoices), and can hand a **frozen,
verifiable passport** to a buyer (secondary reader: a service shop). The buyer's goal is to know
the real state of the car; trust comes from the **evidence level** of each entry.

## 2. Goals / Non-goals / Anti-goals

**Goals (v1)** — exactly these modules, nothing else:
1. Garage (vehicle + ownership periods)
2. Manual history (events)
3. Invoice scanner ("AI Deviz Scanner") incl. batch import (≤ 20 files)
4. Timeline
5. Passport (frozen snapshot + hash, PDF, public link, QR, revoke/expiry)

**Non-goals (v1):** health score; 3D / 360° rendering and car photo media; mobile work; payments;
service-shop accounts; notifications.

**Anti-goals:** the passport ever exposing owner data; a public link that cannot be revoked;
a snapshot that changes after creation; a scanned value saved as `DOCUMENTED` without explicit
user confirmation; domain logic that depends on a framework.

## 3. Domain principles

- **History belongs to the VIN.** A user has only *ownership periods* (`ownedFrom`, `ownedTo?`).
- **Evidence levels** (ordered): `ESTIMATED < USER_CONFIRMED < DOCUMENTED < VERIFIED`.
  - Manual event → `USER_CONFIRMED`. Confirmed scan → `DOCUMENTED`.
  - `ESTIMATED` and `VERIFIED` exist in the enum; no v1 flow produces them (VERIFIED needs a
    third-party source — future). Events never silently downgrade.
- **Ownership transfer (agreed):** history stays on the VIN, never deleted/copied. Previous owner's
  period is closed (`ownedTo` set); they lose read/edit access but their events remain in the
  timeline. New owner opens a new period and sees prior history **without personal data of
  anyone**. If the VIN has an active owner, a transfer is *not* automatic: the new user files a
  **claim**; the current owner confirms or it expires. *Claim mechanics (TTL, notification) — to be
  discussed*; v1 implements: file claim, owner approve/reject.
- Only the **active owner** can add/edit/delete events, scan, and create passports.

## 4. Technical decisions

| Decision | Source |
|---|---|
| Quarkus (latest), Java 25, Maven | user |
| Hexagonal, feature-first, per `.claude/ARCHITECTURE.md` | user (existing) |
| Hibernate ORM with Panache over JDBC, Postgres (Supabase) | user |
| Schema only via Flyway migrations (no hbm2ddl, no dashboard edits) | user |
| Auth: Supabase JWT, backend validates via JWKS (`quarkus-oidc`, bearer-only); `sub` = `ownerId` | user chose Supabase; mechanism = **my call** |
| Storage: Supabase Storage through its S3-compatible API behind a `port/out` | user chose Supabase; S3 API = **my call** |
| Authorization in the application layer; Supabase RLS not relied upon | **my call** |
| Spec: Gherkin `.feature` files run with Cucumber-JVM over Quarkus | user |
| Architecture tests: ArchUnit | user |
| Diagrams: PlantUML per feature under `docs/diagrams/` | user |
| OCR / AI extraction provider | **to be discussed** — only `ReceiptExtractionPort` is defined |
| Maven coordinates / modules | single module `server` (**my call**) |
| Passport PDF library, QR library | builder's choice (keep behind ports) |

## 5. Features

Packages under `com.vehiclepassport.server`: `vehicle`, `event`, `scan`, `passport`, plus `shared`.
Cross-feature calls only through the other feature's `application/port/in`.

### 5.1 `vehicle` — Garage & ownership
- Model: `Vehicle(vin, make, model, engine, year, fuel)`, `OwnershipPeriod(vin, ownerId, from, to?)`,
  `OwnershipClaim(id, vin, claimantId, status)`.
- VIN validated (17 chars, ISO 3779 charset, no I/O/Q; check digit is *not* enforced — EU cars
  often fail it. **my call**).
- Use cases: `RegisterVehicleUseCase`, `ListMyVehiclesUseCase`, `GetVehicleUseCase`,
  `FileOwnershipClaimUseCase`, `DecideOwnershipClaimUseCase`, `AssertActiveOwnerUseCase`
  (consumed by other features).
- Diagram: `docs/diagrams/vehicle.puml`.

```gherkin
Feature: Garage
  Scenario: Register a new vehicle
    Given I am an authenticated user
    When I register vehicle "WVWZZZ1JZXW000001" Volkswagen Golf 2018 diesel
    Then the vehicle exists in my garage
    And I have an open ownership period for it

  Scenario: VIN already has an active owner
    Given vehicle "WVWZZZ1JZXW000001" is owned by another user
    When I register the same VIN
    Then no ownership is created
    And an ownership claim is filed for the current owner to decide

  Scenario: Approved claim transfers ownership
    Given a pending claim by me on a vehicle owned by Alice
    When Alice approves the claim
    Then Alice's ownership period is closed
    And I have an open ownership period
    And Alice's past events remain in the vehicle history without her identity
```

### 5.2 `event` — Manual history & Timeline
- Model: `VehicleEvent(id, vin, type{SERVICE,REPAIR,TIRES,ITP}, date, odometerKm, costAmount,
  currency, notes, evidence, source{MANUAL,SCAN}, createdBy)`.
- Rules: date not in the future; km ≥ 0; cost ≥ 0; **odometer monotonic over time** (an event
  whose km contradicts neighbours by date is rejected with a domain error; user may correct).
- Timeline = all events of the VIN, chronological (date, then createdAt), cursor-paginated;
  visible to the active owner (incl. events from previous owners, creator identity stripped).
- Use cases: `AddEventUseCase`, `UpdateEventUseCase`, `DeleteEventUseCase`, `GetTimelineUseCase`,
  `SaveConfirmedEventUseCase` (used by `scan`).
- Diagram: `docs/diagrams/event-timeline.puml`.

```gherkin
Feature: Manual history
  Scenario: Add a service event
    Given I own vehicle V
    When I add a SERVICE event on 2025-03-01 at 120000 km costing 450 RON
    Then the event is saved with evidence USER_CONFIRMED

  Scenario: Reject contradictory mileage
    Given V has an event on 2025-03-01 at 120000 km
    When I add an event on 2025-06-01 at 90000 km
    Then it is rejected with an odometer inconsistency error

Feature: Timeline
  Scenario: Chronological order across owners
    Given V has events by a previous owner and by me
    When I request the timeline
    Then events are in chronological order
    And no event reveals who created it
```

### 5.3 `scan` — Invoice scanner & batch import
- Flow: upload file (image/PDF) to storage → create `ScanJob(PENDING)` → async extraction via
  `ReceiptExtractionPort` (**TBD**; a fake adapter drives all tests) → `ScanResult` with fields
  `{serviceName, date, odometerKm, parts[], labor, total}` each carrying `confidence 0..1` →
  validation → owner reviews → **confirm/correct** → event saved as `DOCUMENTED`.
- Validation (domain): sum(parts)+labor == total (tolerance 0.01); km monotonic (as 5.2); date
  not future. Failures produce *warnings* attached to the result; the user may still correct and
  confirm. Low confidence does not block confirmation.
- Batch: a `ScanBatch` of **≤ 20** jobs; each job confirmed independently, in any order.
- Job states: `PENDING → EXTRACTED → CONFIRMED | REJECTED`, or `FAILED`.
- File limits (size, MIME allow-list) — **my call**: image/jpeg, image/png, application/pdf, ≤ 10 MB.
- The original file is kept and linked to the event as its document.
- Use cases: `SubmitScanUseCase`, `SubmitScanBatchUseCase`, `GetScanJobUseCase`,
  `ConfirmScanUseCase`, `RejectScanUseCase`.
- Diagram: `docs/diagrams/scan.puml`.

```gherkin
Feature: Invoice scanner
  Scenario: Confirm an extracted invoice
    Given I submitted an invoice photo for vehicle V and extraction finished
    When I confirm the extracted data
    Then an event with evidence DOCUMENTED is added to V
    And the original file is attached to the event

  Scenario: Totals mismatch is flagged
    Given extraction returned parts 300, labor 100, total 500
    Then the result carries a total-mismatch warning

  Scenario: Corrections are saved
    Given an extracted result with km 12000
    When I confirm with corrected km 120000
    Then the event stores km 120000

  Scenario: Batch limit
    When I submit a batch of 21 files
    Then it is rejected

  Scenario: Never auto-confirm
    Given extraction finished
    Then no event exists until I confirm
```

### 5.4 `passport` — Snapshot, public link, QR, PDF
- `Passport(id, vin, createdBy, createdAt, snapshot, hash, status, expiresAt?)`;
  `PublicLink(token, passportId, expiresAt?, revokedAt?)`.
- Snapshot = immutable JSON of vehicle data (VIN, make, model, engine, year, fuel) + all events
  (type, date, km, cost, notes, evidence, document-present flag) at creation time. **No owner
  identifiers, no creator ids, no ownership dates.** Canonical serialization (sorted keys) →
  SHA-256 `hash`; PDF embeds the hash and the public URL; QR encodes the public URL.
- Public token: ≥ 128 bits from `SecureRandom`, URL-safe; stored recoverably so the owner can
  re-open the link/QR/PDF later (**my call**, see §10). Public endpoint is unauthenticated, read-only, returns 404 for unknown, revoked or
  expired (same response, no information leak) and serves the snapshot + hash (+ PDF download).
- Revoke is idempotent; expiry optional at creation. v1: exactly one link per passport
  (**my call**); to re-share, create a new passport.
- Use cases: `CreatePassportUseCase`, `RevokePassportLinkUseCase`, `ListMyPassportsUseCase`,
  `GetPublicPassportUseCase`, `GetPassportPdfUseCase`.
- Diagram: `docs/diagrams/passport.puml`.

```gherkin
Feature: Passport
  Scenario: Snapshot is frozen
    Given I created a passport for V
    When I add a new event to V
    Then the passport content and hash are unchanged

  Scenario: No owner data leaks
    When anyone opens the public link
    Then the response contains no owner or creator identifiers

  Scenario: Revoked link
    Given a public link I revoked
    When anyone opens it
    Then the response is 404

  Scenario: Expired link
    Given a link with expiry in the past
    Then it behaves exactly like a revoked link

  Scenario: Hash verifies
    Then recomputing the hash of the served snapshot equals the published hash
```

## 6. Cross-cutting

- **API:** `contracts/openapi.yaml` is written first (currently empty); resources match it
  exactly. Error shape: RFC 9457 problem+json (**my call**) produced by one mapper in `shared/error`.
- **Security:** all endpoints require a Supabase JWT except `GET /public/passports/{token}` (+ pdf).
  Authorization failures on foreign vehicles return 404 (no existence leak) (**my call**).
- **Async scanning:** persisted jobs processed by a worker (Quarkus scheduler/Vert.x); polling API
  for status in v1; no message broker (**my call**).
- **Config:** `@ConfigMapping`; Supabase URL, JWKS, S3 endpoint/keys from env.
- **Package layout:** as in ARCHITECTURE.md. Note: the existing `ARCHITECTURE.md` mentions
  `backend/vehicle-server`; actual folder is `server/` — fix the doc.

## 7. Testing strategy (SDD)

1. **Gherkin first:** every feature above ships `.feature` files in
   `src/integration-test/resources/features/<feature>/`, written and reviewed before code.
   Step definitions drive the application via real use cases; infrastructure faked at `port/out`
   (in-memory repos, fake extraction, fake storage) for fast behaviour tests, plus a smaller
   `@QuarkusTest` suite against Postgres (Testcontainers, Flyway applied) for persistence and the
   HTTP/auth path.
2. **ArchUnit** (`src/test/java/.../architecture/`): enforce all rules in
   `.claude/rules/backend-architecture.md` — layer direction, pure `domain` (no
   Quarkus/JPA/JAX-RS/Jackson), no `api → infrastructure`, cross-feature only via `port/in`,
   `shared` independent of features, naming conventions (`*Resource`, `*UseCase`, `*Port`,
   `*Service`, `*Entity`), `@Transactional` only in `application.service`. ArchUnit runs first in CI.
3. **Unit tests** for domain rules (evidence, odometer monotonicity, sum validation, snapshot
   hashing) without Quarkus.
4. Order of delivery: ArchUnit skeleton → `vehicle` → `event` → `scan` (fake extractor) →
   `passport`. Each feature: feature file → puml → failing steps → implementation.

## 8. Left to the builder

Maven dependency versions; Cucumber↔Quarkus wiring; PDF/QR libraries; DB schema details and
indexes; pagination format; exact HTTP paths (decided in openapi.yaml, contract-first); worker
implementation.

## 10. Calls made after the builder check (all **my call**, change freely)

1. **Token/PDF/QR:** the public token is stored recoverably (it is a bearer capability, like an
   unlisted link). The owner can re-fetch link, QR and PDF anytime. PDF is generated at creation and
   stored (object storage); public base URL is config (`passport.public-base-url`).
2. **Odometer vs. amounts:** a contradictory odometer is a **hard error** everywhere (manual add,
   edit, scan confirm) — in the scan flow the user fixes the km in the confirm step. Total/sum
   mismatch is only a **warning**. Same-day events order by `createdAt`. Edit/delete re-validates
   the neighbours; a change that would break monotonicity is rejected. (Fixes the §5.2/§5.3 wording.)
3. **Claims:** multiple pending claims per VIN allowed; the owner lists pending claims and
   approves/rejects one (approving rejects the others); the claimant can withdraw. **No TTL in v1**
   (to be discussed). The active owner can release a vehicle; a VIN with history but no active
   owner can be registered freely by anyone, who then sees the history. Only the active owner can
   correct vehicle data.
4. **Scan → event mapping:** the user picks the event type at confirm time (default SERVICE);
   `total` → `costAmount`; currency defaults to RON, overridable. Parts, labor and service name are
   stored in a structured `details` JSON on the event (`serviceName`, `parts[{name,qty,price}]`,
   `labor`) and included in the passport snapshot; free-text `notes` stays separate.
5. **Worker:** assume multiple instances; use `SELECT … FOR UPDATE SKIP LOCKED`, a processing
   timeout (jobs stuck in PROCESSING are returned to PENDING), max 3 attempts, then `FAILED`
   (provider error, timeout, unreadable file). A failed job can be resubmitted as a new job. Batch
   endpoint accepts all ≤ 20 files in one multipart request and creates the jobs.
6. **Hash:** canonical JSON = UTF-8, keys sorted, no whitespace, dates ISO-8601, money as decimal
   strings with 2 places, nulls omitted, events sorted by (date, id). The hash is an integrity
   checksum, **not a signature** — signing is out of v1 and noted as a future trust anchor.
7. **Documents & privacy:** invoice files are visible only to the owner of the period in which the
   event was created; later owners see that a document exists, not the file. Events are soft-deleted;
   existing passports are unaffected. In-flight scan jobs are cancelled when ownership ends.
8. **Users:** `ownerId` = JWT `sub`; no user table in v1. Account deletion / GDPR erasure — to be
   discussed.
9. **Public endpoint:** no application-level rate limiting in v1 (left to the edge/infra).

## 11. Decided by the user

- A new owner **cannot** edit or delete events created by a previous owner. An event is editable
  only by the owner of the ownership period that created it (the event stores its period internally;
  never exposed in timeline or passport). Since a closed period has no active owner, events from
  closed periods are effectively immutable.

```gherkin
Scenario: New owner cannot alter prior history
  Given Alice created event E during her ownership period, then ownership moved to me
  When I try to edit or delete E
  Then it is rejected as forbidden
```

## 9. Open / to be discussed

- OCR / AI extraction provider and its privacy constraints.
- Ownership claim lifecycle (TTL, notifications).
- Whether a VERIFIED source will ever exist (and which).
- Health score, 3D/360 (explicitly out of v1).
