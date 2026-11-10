# Onboarding, Car Context and Car Look (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The server stores, returns and protects the vehicle's `plate` and `appearance` exactly as `contracts/openapi.yaml` (commit `3413da1`) and the mobile plan expect.

**Architecture:** Feature-first hexagonal, inside `vehicle`. Domain value objects (`Plate`, `Appearance` and six enums) come first, then the columns, then the use case and the REST layer, then the plate-clearing rule on transfer and the passport guard. Behaviour is proven in Gherkin on the fakes (no database) and in `@QuarkusTest` ITs against Postgres.

**Tech Stack:** Java 21, Quarkus (REST Jackson, Hibernate ORM Panache, Flyway, Hibernate Validator), PostgreSQL 17, JUnit 5, Cucumber (`BehaviourIT`), RestAssured, ArchUnit.

**Spec:** `docs/superpowers/specs/2026-11-10-onboarding-backend-design.md` ("design", decisions B1–B8). Parent: `docs/superpowers/specs/2026-11-10-onboarding-design.md` §9.

**Path shorthand:** `M/` = `server/src/main/java/com/vehiclepassport/server/` · `U/` = `server/src/test/java/com/vehiclepassport/server/` · `I/` = `server/src/integration-test/java/com/vehiclepassport/server/` · `G/` = `server/src/integration-test/resources/features/` · `DB/` = `server/src/main/resources/db/migration/`.

| Command | Runs |
|---|---|
| `UNIT <Class>` | `mvn -f server/pom.xml -B -ntp test -Dtest=<Class>` |
| `FAST` | `mvn -f server/pom.xml -B -ntp verify -Dquarkus.build.skip=true -Dit.test=BehaviourIT` (ArchUnit, unit, Gherkin; no DB) |
| `IT <Class>` | `mvn -f server/pom.xml -B -ntp verify -Dit.test=<Class>` (Docker) |
| `FULL` | `mvn -f server/pom.xml -B -ntp verify` (Docker) |

## Global Constraints

- Branch `feat/onboarding-car-context`. Edit only under `server/`. `contracts/openapi.yaml` is read-only here.
- Enum values, verbatim: `BodyType [HATCHBACK, SEDAN, ESTATE, SUV, COUPE, MPV, PICKUP]`, `PaintColor [WHITE, BLACK, SILVER, GREY, BLUE, RED, GREEN, BEIGE, BROWN, YELLOW, ORANGE, GOLD]`, `PaintFinish [GLOSS, METALLIC, SATIN, MATTE]`, `WheelStyle [FIVE_SPOKE, MULTI_SPOKE, AERO]`, `RimColor [SILVER, BLACK, BODY]`, `GlassTint [LIGHT, DARK]`.
- Plate: `^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$`, 1–10 chars, no server-side normalising. `colorHex`: `^#[0-9a-f]{6}$`.
- The plate is never logged, never put in an exception `detail`, and never part of a passport snapshot, the public passport, or the PDF.
- `domain` imports nothing from Quarkus, JPA, JAX-RS or Jackson (`ArchitectureTest` enforces this).
- JSON field names exactly as the contract: `plate`, `appearance`, `bodyType`, `color`, `colorHex`, `finish`, `wheels`, `rimColor`, `glassTint`, `contrastRoof`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **`PATCH { "model": "Passat" }` on a car with a plate and a look** keeps both. → Task 3 (`patch_other_field_keeps_plate_and_look`).
2. **`PATCH { "plate": null }`** clears the plate and leaves the look; `PATCH { "appearance": {...} }` without `plate` leaves the plate. → Task 3.
3. **A car is released, then registered by someone else** (the "VIN with history keeps its data" path): the new owner sees no plate and the old look. → Task 4.
4. **A rejected plate like `"b 123"`** answers 400 and the response body does not contain the submitted value. → Task 1 (domain detail) and Task 3 (HTTP).
5. **A passport created for a car with a plate and a look**: the stored `snapshot_json` and the public response contain neither `plate` nor `appearance`. → Task 4.

---

### Task 1: Domain: plate, appearance, vehicle

**Files:**
- Create: `M/vehicle/domain/model/Plate.java`, `Appearance.java`, `BodyType.java`, `PaintColor.java`, `PaintFinish.java`, `WheelStyle.java`, `RimColor.java`, `GlassTint.java`
- Modify: `M/vehicle/domain/model/Vehicle.java`; every `new Vehicle(…)` / `Vehicle.of(…)` call site (`VehicleService`, `VehiclePanacheRepository`, tests): pass `null, null` for now
- Test: `U/vehicle/domain/PlateTest.java`, `AppearanceTest.java`, `VehicleTest.java`

**Interfaces:**
- Produces:

```java
public record Plate(String value) {                 // compact ctor validates; throws InvalidVehicleDataException("plate is not valid") — never echoes the value
    public static Plate ofNullable(String raw);     // null → null
}
public enum BodyType { …; public static BodyType parse(String raw); }   // same for PaintColor, PaintFinish, WheelStyle, RimColor, GlassTint
// parse: null → null; exact upper-case match only; unknown → InvalidVehicleDataException("unknown <field>: " + raw)
public record Appearance(BodyType bodyType, PaintColor color, String colorHex, PaintFinish finish,
                         WheelStyle wheels, RimColor rimColor, GlassTint glassTint, Boolean contrastRoof) {
    // compact ctor: colorHex null or matches ^#[0-9a-f]{6}$, else InvalidVehicleDataException("colorHex is not valid")
    public boolean isEmpty();                       // every component null
    public static Appearance orNull(Appearance a);  // null or empty → null (design B2)
}
public record Vehicle(Vin vin, String make, String model, String engine, int year, Fuel fuel,
                      Plate plate, Appearance appearance) {
    // compact ctor: appearance = Appearance.orNull(appearance)
    public static Vehicle of(Vin vin, String make, String model, String engine, int year, String fuel,
                             Plate plate, Appearance appearance, Clock clock);
    public Vehicle withoutPlate();
}
```

- [ ] **Step 1: Write the failing tests**

```java
// PlateTest
@ParameterizedTest @ValueSource(strings = {"B 123 ABC", "CJ-45-DUS", "A", "AB12CD34EF"})
void accepts_normalised_plates(String raw) { assertEquals(raw, new Plate(raw).value()); }
@ParameterizedTest @ValueSource(strings = {"b 123", "ABCDEFGHIJK", " B1", "B1 ", "-B1", "B1-", "", "B_1"})
void rejects(String raw) {
    var e = assertThrows(InvalidVehicleDataException.class, () -> new Plate(raw));
    assertEquals("invalid-vehicle", e.code());
    if (!raw.isBlank()) assertFalse(e.getMessage().contains(raw.trim()));   // the value is never echoed
}
@Test void ofNullable_null_is_null() { assertNull(Plate.ofNullable(null)); }
```

The contract pattern allows inner double spaces (`"B  1"` is valid on the server); the single-space rule is the app's normalisation, not a server check.

```java
// AppearanceTest
@Test void parses_every_contract_value() { /* for each enum, every literal in Global Constraints parses to itself */ }
@ParameterizedTest @ValueSource(strings = {"BUGGY", "suv", ""}) void unknown_body_type_is_refused(String raw) { assertThrows(InvalidVehicleDataException.class, () -> BodyType.parse(raw)); }
@ParameterizedTest @ValueSource(strings = {"red", "#FF0000", "#ff00", "ff0000"}) void bad_hex_is_refused(String hex) { /* new Appearance(null, null, hex, …) throws */ }
@Test void empty_appearance_becomes_null() { assertNull(Appearance.orNull(new Appearance(null, null, null, null, null, null, null, null))); }
// VehicleTest
@Test void without_plate_keeps_everything_else() { /* vehicle with plate + appearance → withoutPlate(): plate null, appearance equal, make/model/... equal */ }
@Test void empty_appearance_is_stored_as_null() { /* Vehicle.of(..., null, emptyAppearance, clock).appearance() == null */ }
```

- [ ] **Step 2: Run** `UNIT 'PlateTest,AppearanceTest,VehicleTest'`: expect compilation FAIL.
- [ ] **Step 3: Implement** the types above. Update the existing call sites to pass `null, null` so the build compiles; behaviour is unchanged until Task 3.
- [ ] **Step 4: Run** the three tests, then `FAST`: expect PASS (ArchUnit included).
- [ ] **Step 5: Commit** `server/src/main/java/com/vehiclepassport/server/vehicle server/src/test server/src/integration-test` with `feat(server): plate and appearance in the vehicle domain`.

---

### Task 2: Persistence

**Files:**
- Create: `DB/V5__vehicle_look.sql`
- Modify: `M/vehicle/infrastructure/persistence/entity/VehicleEntity.java`, `M/vehicle/infrastructure/persistence/repository/VehiclePanacheRepository.java`
- Test: `I/vehicle/VehiclePersistenceIT.java`

**Interfaces:**
- Consumes: `Vehicle`, `Plate`, `Appearance` and enums (Task 1).
- Produces: columns on `vehicle_passport.vehicle`: `plate varchar(10)`, `body_type varchar(20)`, `paint_color varchar(20)`, `paint_hex char(7)`, `paint_finish varchar(20)`, `wheel_style varchar(20)`, `rim_color varchar(20)`, `glass_tint varchar(20)`, `contrast_roof boolean`. All nullable, no defaults. One `check (col in (…))` per enum column, listing the Global Constraints values; `check (paint_hex ~ '^#[0-9a-f]{6}$')`.

- [ ] **Step 1: Write the failing tests** in `VehiclePersistenceIT`

```java
@Test void saves_and_reads_plate_and_full_appearance() { /* save Vehicle with Plate("B 123 ABC") and every appearance field set (contrastRoof true, colorHex "#1c6b49"); findByVin → equal record */ }
@Test void saves_and_reads_a_vehicle_with_neither() { /* plate null, appearance null round-trip */ }
@Test void saving_without_plate_clears_the_column() { /* save with plate, then save withoutPlate(); native query select plate → null */ }
@Test void database_refuses_an_unknown_body_type() { /* native update set body_type = 'BUGGY' → PersistenceException */ }
```

- [ ] **Step 2: Run** `IT VehiclePersistenceIT`: expect FAIL.
- [ ] **Step 3: Implement.** The migration is additive only. The entity stores enums as `String` (`name()`), as `fuel` does. `toDomain` builds `Appearance` from the eight columns and lets `Appearance.orNull` turn all-null into `null`. `save` writes all nine columns every time, so `withoutPlate()` really clears.
- [ ] **Step 4: Run** `IT VehiclePersistenceIT`: expect PASS.
- [ ] **Step 5: Commit** with `feat(server): store plate and look on the vehicle`.

---

### Task 3: Read and update over HTTP

**Files:**
- Create: `M/vehicle/application/port/in/AppearanceView.java`, `M/vehicle/api/dto/AppearanceDto.java`, `G/vehicle/look.feature`, `I/vehicle/steps/LookSteps.java`
- Modify: `M/vehicle/application/port/in/VehicleView.java`, `UpdateVehicleUseCase.java`, `M/vehicle/application/service/VehicleService.java`, `M/vehicle/api/dto/UpdateVehicleRequest.java`, `VehicleResponse.java`, `M/vehicle/api/mapper/VehicleDtoMapper.java`, `M/passport/infrastructure/client/SnapshotSourceAdapter.java` (only if the `VehicleView` change breaks compilation), `I/vehicle/steps/GarageSteps.java` (new command arity)
- Test: `I/vehicle/VehicleResourceIT.java`, `G/vehicle/look.feature`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:

```java
// port/in — strings only, like VehicleView.fuel
public record AppearanceView(String bodyType, String color, String colorHex, String finish,
                             String wheels, String rimColor, String glassTint, Boolean contrastRoof) {}
public record VehicleView(String vin, String make, String model, String engine, int year, String fuel,
                          String plate, AppearanceView appearance) {}          // plate/appearance nullable
record UpdateVehicleCommand(UUID userId, String vin, String make, String model, String engine, int year,
                            String fuel, String plate, AppearanceView appearance) {}   // fully resolved: the mapper has overlaid current values
// api/dto
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AppearanceDto(String bodyType, String color, @Pattern(regexp = "^#[0-9a-f]{6}$") String colorHex,
                            String finish, String wheels, String rimColor, String glassTint, Boolean contrastRoof) {}
public class UpdateVehicleRequest {            // design B4: setters record presence
    // existing make/model/engine/year/fuel keep their constraints
    @Pattern(regexp = "^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$") @Size(min = 1, max = 10) String plate;
    @Valid AppearanceDto appearance;
    public boolean hasPlate();                 // true when the JSON contained "plate", even as null
    public boolean hasAppearance();
    @JsonIgnore @AssertTrue(message = "at least one field is required") boolean isNotEmpty();      // now also counts hasPlate()/hasAppearance()
    @JsonIgnore @AssertTrue(message = "appearance may not be null") boolean isAppearanceNotNull(); // !hasAppearance() || appearance != null (design B5)
}
public record VehicleResponse(String vin, String make, String model, String engine, int year, String fuel,
                              String plate, AppearanceDto appearance) {}   // plate/appearance always serialised, null when unset
```

Mapper overlay: `plate = r.hasPlate() ? r.getPlate() : current.plate()`; `appearance = r.getAppearance() != null ? toView(r.getAppearance()) : current.appearance()`. `VehicleService.update` passes `Plate.ofNullable(c.plate())` and the parsed `Appearance` into `Vehicle.of`; `view()` fills the two new fields. `register` creates vehicles with `null, null`.

- [ ] **Step 1: Write `G/vehicle/look.feature`**

```gherkin
Feature: Plate and look
  Scenario: A new car has no plate and no look
    When I register vehicle "WVWZZZ1JZXW000001" Volkswagen Golf 2018 diesel
    Then my vehicle has no plate and no look

  Scenario: Saving a look and a plate
    Given I own vehicle "WVWZZZ1JZXW000001"
    When I save the look SUV BLUE MATTE AERO BLACK DARK with a black roof and plate "B 123 ABC"
    Then my vehicle has plate "B 123 ABC" and body type "SUV" and colour "BLUE"

  Scenario: The look is replaced as a whole
    Given my vehicle has the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When I save only the colour "RED"
    Then my vehicle's look is exactly colour "RED"

  Scenario: Clearing the plate
    Given my vehicle has plate "B 123 ABC"
    When I clear the plate
    Then my vehicle has no plate
    And its look is unchanged

  Scenario: Editing other details keeps the plate and look
    Given my vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When I change its model to "Passat"
    Then my vehicle has plate "B 123 ABC" and body type "SUV" and colour "BLUE"

  Scenario: Only the owner sets the look
    Given vehicle "WVWZZZ1JZXW000001" is owned by another user
    When I save only the colour "RED"
    Then it is rejected with code "vehicle-not-found"
```

- [ ] **Step 2: Write `LookSteps`** against `UpdateVehicleUseCase` / `GetVehicleUseCase` (pattern: `GarageSteps`; reuse its existing step definitions, don't duplicate them). Run `FAST`: expect FAIL.
- [ ] **Step 3: Write the failing HTTP tests** in `VehicleResourceIT`

```java
@Test void post_returns_null_plate_and_appearance()          // 201 body: plate nullValue(), appearance nullValue()
@Test void patch_sets_plate_and_appearance_and_get_returns_them()   // PATCH {plate:"B 123 ABC", appearance:{bodyType:"SUV",color:"BLUE",finish:"MATTE"}} → 200; GET → same; appearance has no "wheels" key (design B3)
@Test void patch_null_plate_clears_it()                      // then GET plate nullValue(); appearance unchanged
@Test void patch_other_field_keeps_plate_and_look()          // Review Focus 1
@Test void patch_appearance_only_keeps_plate()               // Review Focus 2
@Test void patch_plate_only_is_not_empty()                   // {"plate":null} alone → 200, not validation-failed
@ParameterizedTest @ValueSource(strings = {
    "{\"plate\":\"b 123\"}", "{\"plate\":\"ABCDEFGHIJK\"}", "{\"plate\":\"\"}",
    "{\"appearance\":{\"bodyType\":\"BUGGY\"}}", "{\"appearance\":{\"colorHex\":\"red\"}}",
    "{\"appearance\":{\"extra\":1}}", "{\"appearance\":null}", "{\"appearance\":{\"contrastRoof\":\"yes\"}}" })
void patch_invalid_look_400(String body)                     // 400, problem+json, code in (validation-failed, invalid-vehicle), body does not contain "b 123" / "ABCDEFGHIJK"
@Test void list_returns_plate_and_appearance()
```

- [ ] **Step 4: Run** `IT VehicleResourceIT`: expect FAIL.
- [ ] **Step 5: Implement** the interfaces above.
- [ ] **Step 6: Run** `FAST`, then `IT VehicleResourceIT`, then `IT ContractConformanceIT`: expect PASS.
- [ ] **Step 7: Commit** with `feat(server): read and update the vehicle's plate and look`.

---

### Task 4: Transfer clears the plate; passports never carry it

**Files:**
- Modify: `M/vehicle/application/service/VehicleService.java` (`release`), `M/vehicle/application/service/OwnershipClaimService.java` (inject `VehicleRepositoryPort`; `approve`), `G/vehicle/look.feature`, `I/vehicle/steps/LookSteps.java`
- Test: `I/passport/PassportResourceIT.java`, `I/passport/PublicPassportResourceIT.java`, `U/passport/domain/SnapshotTest.java`
- Modify: `server/README.md` (one line under the vehicle API: plate is owner-only, cleared on transfer, never in a passport)

**Interfaces:**
- Consumes: `Vehicle.withoutPlate()` (Task 1), `VehicleRepositoryPort.save`.
- Produces: no new types.

- [ ] **Step 1: Add the scenarios** to `look.feature`

```gherkin
  Scenario: Approving a claim clears the plate and keeps the look
    Given a pending claim by me on a vehicle owned by Alice
    And Alice's vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    When Alice approves my claim
    Then my vehicle has no plate
    And my vehicle has body type "SUV" and colour "BLUE"

  Scenario: Releasing clears the plate for the next owner
    Given Alice's vehicle has plate "B 123 ABC" and the look SUV BLUE MATTE AERO BLACK DARK with a black roof
    And Alice released it
    When I register the same VIN
    Then my vehicle has no plate
    And my vehicle has body type "SUV" and colour "BLUE"

  Scenario: Rejecting a claim keeps the plate
    Given a pending claim by me on a vehicle owned by Alice
    And Alice's vehicle has plate "B 123 ABC"
    When Alice rejects the claim
    Then Alice's vehicle still has plate "B 123 ABC"
```

Reuse the claim steps from `ClaimSteps`.

- [ ] **Step 2: Write the passport guards**

```java
// PassportResourceIT
@Test void snapshot_never_contains_plate_or_appearance()   // owner sets plate "B 123 ABC" + appearance, creates a passport;
                                                           // native select snapshot_json → contains neither "plate", "appearance" nor "B 123 ABC"
// PublicPassportResourceIT
@Test void public_passport_has_no_plate_or_appearance()    // GET /public/passports/{token} body as string: no "B 123 ABC", no "appearance"
```

- [ ] **Step 3: Run** `FAST`, `IT PassportResourceIT`, `IT PublicPassportResourceIT`: expect the Gherkin FAIL (the passport tests may already pass; they are guards).
- [ ] **Step 4: Implement.** In `release` and `approve`, inside the existing lock and transaction: `vehicles.findByVin(vin).ifPresent(v -> vehicles.save(v.withoutPlate()))`.
- [ ] **Step 5: Run** `FULL`: expect PASS.
- [ ] **Step 6: Commit** with `feat(server): clear the plate on transfer and keep it out of passports`.
