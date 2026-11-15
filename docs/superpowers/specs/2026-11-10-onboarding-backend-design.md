# Onboarding, Car Context and Car Look: Backend Design

**Parent spec:** `docs/superpowers/specs/2026-11-10-onboarding-design.md` (§9 lists the backend work this design covers).
**Mobile plan:** `docs/superpowers/plans/2026-11-10-onboarding-car-context.md`.
**Contract:** already committed (`3413da1 feat(contract): add plate and appearance to the vehicle`). The server follows it; this work does not edit `contracts/`.

## Intent

The mobile app now lets an owner give each car a number plate and a look (shape, paint, finish, wheels, rims, glass, roof). Both live on the server. Until the server stores them, the app works only against its fake API. This design makes the real server match the contract and the app's behaviour, and changes nothing outside `server/`.

## Goals

1. `PATCH /vehicles/{vin}` accepts `plate` and `appearance`. `plate: null` clears the plate; an absent `plate` keeps it. `appearance` replaces the stored object as a whole.
2. `POST /vehicles`, `GET /vehicles`, `GET /vehicles/{vin}` and `PATCH` return `plate` and `appearance`, each `null` when unset.
3. A newly registered car has no plate and no look.
4. The plate is cleared when the car changes hands: on release, and on approval of an ownership claim. The look is kept.
5. Neither the plate nor the look enters a passport snapshot, the public passport, or the PDF. **Owner's call (2026-11-10): the look stays inside the app for now.**
6. Invalid input is refused with 400, as the app's fake does: a non-normalised or over-long plate, an unknown enum value, a malformed `colorHex`, an unknown property inside `appearance`.

## Non-goals

- Normalising the plate on the server. The app normalises it; the server only checks the contract pattern.
- Mapping a `colorHex` to its nearest named colour. The app sends both.
- Any change to registration (`RegisterVehicleRequest` is unchanged), to scans, events or passports beyond keeping the plate out.
- A VIN filter on `listMyPassports`. The app filters on the client.

## Anti-goals

- The plate showing up anywhere a non-owner can read it: a passport, a public link, a log line, an error message.
- A new owner inheriting the previous owner's plate.
- `PATCH { "make": "X" }` wiping a stored plate or look.

## Decisions

| # | Decision | Why |
|---|---|---|
| B1 | The look is stored as eight nullable columns on `vehicle` (`body_type`, `paint_color`, `paint_hex`, `paint_finish`, `wheel_style`, `rim_color`, `glass_tint`, `contrast_roof`), with `check` constraints on the enum values. | The schema is relational everywhere else; check constraints keep the database honest; no JSON mapping is needed. |
| B2 | All eight columns null ⇔ `appearance: null` in responses. A PATCH with `appearance: {}` therefore reads back as `null`. | The app treats `null` and `{}` the same (`hasLook` is false for both). |
| B3 | Inside `appearance`, unset fields are omitted from the JSON, not sent as `null`. | The contract makes them optional, not nullable. |
| B4 | `UpdateVehicleRequest` becomes a class with setters that record whether `plate` and `appearance` were present. | Jackson cannot tell "absent" from `null` on a record component, and the contract gives them different meanings. No new dependency. |
| B5 | An explicit `appearance: null` is refused (400 `validation-failed`). | The contract does not make it nullable. |
| B6 | Plate and `colorHex` patterns are checked twice, as `@Pattern` on the DTO (→ `validation-failed`) and in the domain value objects (→ `invalid-vehicle`). Enum fields are strings on the DTO and parsed in the domain (→ `invalid-vehicle`), like `fuel` today. | Follows the existing request-shape / domain-rule split. Both answers are 400, which is all the app checks. |
| B7 | Clearing the plate is a domain method `Vehicle.withoutPlate()`, called by `VehicleService.release` and `OwnershipClaimService.approve` inside their existing transactions. | One rule, two call sites, same lock. |
| B8 | `SnapshotVehicle` does not change. A test pins that snapshot JSON contains neither key. | It already lists its fields explicitly; the test stops a future change from leaking the plate. |

## Shape of the change

- **Domain** (`vehicle/domain/model`): `Plate` value object; `Appearance` record with six enums (`BodyType`, `PaintColor`, `PaintFinish`, `WheelStyle`, `RimColor`, `GlassTint`), `colorHex` and `contrastRoof`; `Vehicle` gains `plate` and `appearance` (both nullable) and `withoutPlate()`.
- **Persistence**: `V5__vehicle_look.sql`; `VehicleEntity` and `VehiclePanacheRepository` map the new columns.
- **Application**: `VehicleView` and `UpdateVehicleCommand` carry `plate` and an `AppearanceView`; `update` builds the vehicle with them.
- **API**: `UpdateVehicleRequest` (tri-state), `AppearanceDto`, `VehicleResponse` and the mapper overlay.
- **Transfer**: release and approve clear the plate.

## Left to the builder

Exact names of private helpers, the test fixture layout, and the error `detail` wording. The detail must never echo the plate value.
