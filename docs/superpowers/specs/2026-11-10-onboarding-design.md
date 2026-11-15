# Onboarding, car context and the car's look

Date: 2026-11-10 · Scope: `mobile/`, plus the contract fields it needs · Status: draft for approval
Design system (visual source of truth): https://claude.ai/artifact/4744YKEHgeUzJgtoCZ3J3Y
Screens to look at there: **Onboarding**, **CarHome**, **CarSwitcher**, **ActionBar**, **Ground**, **CarViewer**.
Supersedes §6, §7 (Garage, Add vehicle, Vehicle detail), §9 and §12.1 of `2026-11-09-mobile-app-design.md`.

Each decision is labelled **owner** (decided by the product owner) or **my call** (open to change).
Q1–Q7 were confirmed in the grilling session of 2026-11-10; Q8–Q17 were accepted when this document was
first requested; Q18–Q23 were decided the same day in the design session. Q14 is replaced by Q19.

## 1. Intent

A new owner should go from nothing to a registered car with its first history entry, and enjoy it. Adding
a car is a short journey with visible steps, ending in a car that looks like theirs. Once there are several
cars, the app is about one car at a time, like a car maker's own app, and it is always obvious which one.
The dark theme should look expensive: black, lit, calm.

## 2. Goals, non-goals, anti-goals

**Goals**
1. A three-step journey replaces the single Add vehicle form (Q8, Q22).
2. Seven unbranded 3D body types, built in code, replace the Ferrari model (Q3, Q4, Q19).
3. The owner can set shape, paint, finish, wheels, glass, roof and plate (Q5, Q11–Q13, Q20).
4. The app follows one active car; the owner switches from the screen title (Q18).
5. The home screen's layout and history are defined (§6).
6. Back and leaving follow platform conventions, with no Cancel at the top of a screen (Q21).
7. The dark background follows the Ground recipe (Q23).

**Non-goals:** scanning the registration certificate (Q7, phase 2); choosing a plate country; commissioned
realistic models; the backend implementation of the new fields (separate plan, §9); the buyer web page
showing the car's look; a tablet layout.

**Anti-goals**
- Any model, light or grille that reads as a real make.
- The plate appearing on a shared passport or surviving a transfer.
- A journey that blocks the app, or that loses a registered car when the owner leaves early.
- Glows, gradient blobs or glass in the dark theme.
- "Cancel" or a cross in a top corner; a labelled Back button in the content.

## 3. Context (as of 2026-11-10)

- `AddVehicleScreen` is a single form: VIN, make, model, engine, year, fuel. If the VIN already has an owner,
  registering it files a claim instead of creating a car.
- `CarViewer` renders one model (`mobile/assets/viewer/ferrari.glb`, Draco) in 4 colours. The colour is
  kept only on the phone (`viewerColorStore`, AsyncStorage, per VIN).
- The Garage tab lists `VehicleCard`s; a car opens `vehicles/[vin]` (stage, actions, history). Scans and
  Passports list every car's items. `VehicleDetailScreen` has a full-width "Back" button at its top, and
  forms end in a full-width "Cancel".
- The contract has no plate, body type or colour fields. `listMyPassports` takes no VIN filter.
- OCR (PaddleOCR) reads service invoices only.

## 4. The journey

```
1 Identify (VIN) → 2 Describe (details) → submit ─┬→ 3 Make it yours (optional) → On the record
                                                  └→ VIN already owned → Claim filed, journey ends
```

| # | Decision | By |
|---|----------|----|
| Q1 | Onboarding is done once **the car is registered with a valid VIN**. Success is measured by **the car getting its first timeline event**. Personalisation is a reward, not a goal. | owner |
| Q2 | Data comes first, personalisation last. A user who drops out after submitting still has a registered car. | owner |
| Q6 | The journey starts automatically when **the garage is empty and there are no pending claims**, not on a first-launch flag. It is full screen and has a "Later" option that leads to the empty Car tab, which shows "Add your first car". | owner |
| Q8 | One journey with two entry points: automatic, and "Add a car" in the car list. It replaces `AddVehicleScreen`. | owner |
| Q9 | The owner check runs **on submit**, after step 2. There is no early VIN-check endpoint, because one would let anyone find out whether a VIN is registered. When a claim is filed, the journey ends on "Claim filed". | owner |
| Q10 | Step 1 shows where to find the VIN: bottom corner of the windscreen, the driver's door pillar, and field E of the registration certificate. **Make** is suggested from the WMI (first 3 VIN characters). Year is **not** guessed from the VIN. | owner |
| Q15 | "Make it yours" can be skipped. A skipped car gets the neutral look (grey sedan) and can be customised later. | owner |
| Q16 | The last screen shows the car in 3D with its colour and plate, plus "Add first service" (opens the invoice scan for that car) and "Later" (goes to the Car tab). | owner |
| Q17 | A journey interrupted before submit keeps a local draft and offers it when the journey is next opened. The draft is cleared on submit or on "Discard". | owner |
| Q22 | The journey shows its steps: three progress bars under the app bar, one screen per step, one decision per screen. | owner |

Screen by screen (copy is final unless marked):

| Step | Content | Primary | Quiet action | Back |
|---|---|---|---|---|
| 1 Identify | Title "Let's find your car". VIN field, mono, uppercased as typed, invalid characters dropped, live count "n / 17". Under it "Looks like a {make}" when the WMI is known. "Where to find it": three rows with small diagrams. | "Continue", disabled until 17 valid characters | "Later" | none |
| 2 Describe | Title "Tell us about it". Make (prefilled from the WMI, helper "Suggested from the VIN. Change it if it's wrong."), model, year, engine (optional), fuel chips. | "Add to my garage" (submits) | none | to step 1, values kept |
| 3 Make it yours | Live stage on top; five topics below: Shape, Paint, Wheels, Glass, Plate. | "Save this look" | "Skip for now" | none: the car is saved |
| On the record | Stage, "{make} {model} is in your garage", one line about scanning. | "Add first service" | "Later" | none |
| Claim filed | Existing copy (`vehicleForm.filedTitle`, `filedBody`). | "Done" | none | none |

Rules (**my call** unless a Q is cited):
- Errors on submit stay on step 2: `invalid-vin` sends the owner back to step 1 with the message under the
  field; `already-owner` offers "View car", which makes that car active; anything else shows under the form.
- Leaving step 1 or 2 with anything typed (system Back, edge swipe, or "Later") asks "Keep this draft?" in a
  sheet: "Keep draft" / "Discard". With nothing typed it just leaves.
- "Later" after an automatic start suppresses the automatic start until the app is next launched.
- The newly registered car becomes the active car at submit, before step 3.
- "Save this look" sends one `updateVehicle` with `appearance` and `plate`. If it fails, the journey stays on
  step 3 with the message; "Skip for now" still works.
- In step 3 the stage turns to the topic: front three-quarter for Shape and Paint, side for Wheels, a
  shallower front angle for Glass, rear three-quarter for Plate. Under Reduce Motion it cuts.
- The same step-3 screen, without progress bars, is "Change look" for an existing car
  (`vehicles/[vin]/look`), with a Back chevron and the single action "Save this look".
- A car with no `appearance` shows a dismissible row "Make it yours" on the home screen (this covers
  skipped cars and approved claims, Q9/Q15). Dismissal is remembered per car on the phone.

## 5. The car's look

| # | Decision | By |
|---|----------|----|
| Q3 | Each body type gets its own 3D model: **stylised and unbranded**, one shared style. A 2D silhouette is the fallback. **The Ferrari 458 model is removed.** | owner |
| Q4 | Seven body types: **Hatchback, Sedan, Estate, SUV, Coupé/Cabrio, MPV/Van, Pickup**. Anything else takes the closest type; body type is visual only. | owner |
| Q19 | The models are **built in code**, not loaded from files: `car-kit.js` lofts each body from a roofline, a belt line and a plan outline. No licence, no GLB, no Draco decoder. The same file draws the 2D silhouettes. Replaces Q14. | owner |
| Q20 | Beyond shape, colour and plate, the owner can choose: **paint finish** (gloss, metallic, satin, matte), **wheels** (five-spoke, multi-spoke, aero) and **rim colour** (silver, black, body colour), **glass tint** (light, dark), a **black contrast roof**, and **any colour** through a hue and lightness picker. | owner |
| Q5 | **The plate is real server data**: optional and editable. Only the owner sees it; it **never** appears on the public passport, and it is cleared when the car is transferred. The model shows it as an EU/RO-style plate. | owner |
| Q11 | The look is **stored on the server** as optional vehicle fields. It may appear on the public passport and transfers with the car. Existing `viewerColorStore` values are migrated once, then the store is removed. | owner |
| Q12 | Colour comes from a **fixed, named palette of 12**: white, black, silver, grey, blue, red, green, beige, brown, yellow, orange, gold. The server stores a code, and the exact shade is the client's. The palette maps to field R of the registration certificate. | owner |
| Q13 | The plate is **free text, normalised**: uppercase, single spaces, at most 10 characters. Not checked against the Romanian format. It renders with the blue EU "RO" band. | owner |

Reconciling Q12 with "any colour" (**my call**): a custom shade is stored as `colorHex` *and* the nearest
palette code is stored as `color`, so the certificate mapping and anything that filters by colour keep
working. Picking a named colour clears `colorHex`.

The source of truth for the models, palette shades and finishes is
`project/components/CarViewer/car-kit.js` and `stage.js` in the design system; the app copies both files.
What the model is and is not: a smooth lofted body, dark glass with pillars, a white light blade at the
nose and a red one at the tail, door mirrors, four wheels, front and rear plates. No badge, no grille
shape, no interior. Labelled "Illustrative model" wherever it appears.

Viewer rules carried over from the previous design: three.js in a `react-native-webview`, everything
bundled, at most one live stage, paused when unfocused or backgrounded, the silhouette shown until
`ready` and on any error, pixel ratio capped at 2, auto-spin off under Reduce Motion.

## 6. Car context

| # | Decision | By |
|---|----------|----|
| Q18 | **The whole app follows one active car.** Its name is the title of the Car, Scans and Passports tabs; tapping it opens the car list. Scans and Passports show only that car's items. Account does not follow the car. | owner |

Details (**my call**):
- **Tabs:** Car, Scans, Passports, Account. The Garage tab and the separate vehicle detail screen are gone;
  the Car tab *is* the active car's detail.
- **Active car:** remembered on the phone per account. If it is missing from the garage (released,
  transferred, first run), the first car in the list becomes active. Registering a car, or choosing
  "View car", makes that car active.
- **Title (CarSwitcher):** make and model, a small down chevron, and the plate under it in mono; the VIN
  when there is no plate. With one car there is no chevron and the title does nothing; "Add a car" is
  then the last item of the home screen's overflow menu.
- **Car list (sheet):** "Your cars". One row per car: silhouette in its own paint, name, plate or VIN, a
  check on the active one. Then pending claims as quiet rows ("Waiting for the current owner", with
  Withdraw). Last row: "Add a car". Choosing a car closes the sheet and announces "Now showing {name}".
- **Scoping:** passports and scan jobs are filtered on the phone by VIN; no API change. "Scan an invoice"
  no longer asks which car: it uses the active one.
- **Passports of cars no longer owned** stay reachable: under the active car's passports, the Passports
  tab lists them in a section "Cars you no longer own", labelled by VIN.
- **Links:** opening `vehicles/{vin}` makes that car active and shows the Car tab. Routes under a car
  (`vehicles/{vin}/events/…`, `/edit`, `/claims`, `/passports/new`, `/look`) are unchanged.
- **No cars:** the Car tab shows the empty state ("Add your first car" and the action), the title reads
  "Your garage", and Scans and Passports show their own "add a car first" empty states.

**Home screen layout** (Car tab), top to bottom:

1. Title bar: CarSwitcher on the left; overflow on the right with "Edit details", "Change look",
   "Give up ownership".
2. Stage: about 30% of the screen height, "Illustrative model" under it.
3. Facts: year · fuel · engine on the left; latest odometer with the evidence badge of the entry it came
   from on the right; "No entries yet" without one.
4. Banners, when they apply: pending claims on this car; "Make it yours".
5. Actions: "Scan an invoice" (primary, full width); "Add event" and "Create passport" (secondary, side
   by side).
6. History: heading with the entry count; entries newest first under year labels; one row per entry with
   day and month, title, odometer and cost, evidence badge; hairlines between rows, no boxes. The row opens
   the entry. Empty: "No history yet" and one line pointing at the scan action.

The whole screen scrolls as one. Loading: skeletons for title and facts, silhouette in the stage.

## 7. Navigation rules

| # | Decision | By |
|---|----------|----|
| Q21 | Back and leaving follow platform conventions. **No Cancel at the top of the screen.** | owner |

How that is applied (**my call**):
- **Back** is a chevron icon in the top left corner (44pt / 48dp target), with the iOS edge swipe and
  Android Back doing the same thing. It is never a labelled button and never in the content.
- **Actions** sit in a bar pinned to the bottom, above the keyboard and the home indicator: one primary
  action and at most one quiet text action under it.
- **The quiet action names what leaving means**: "Later", "Skip for now", "Discard". The word "Cancel"
  is not used.
- **Sheets** close by swiping down or tapping outside; their actions are at the bottom.
- This applies to every existing form too: edit car, add/edit event, create passport, capture. Their
  top "Back"/bottom "Cancel" buttons are replaced by the app bar chevron and the bottom bar.

## 8. Dark theme background

| # | Decision | By |
|---|----------|----|
| Q23 | The dark background must look premium and deliberate. | owner |

The recipe (**my call**; see the Ground component): `bg` true black with a trace of green; one overhead
light, an ellipse from `bg-lift` at the top edge; the bottom falling to `ground-shade`; fine grain so the
light does not band; surfaces separated by a `line` border, a 1px `edge-light` top edge and an offset
shadow. The 3D stage has no background of its own. The token values in the design system's `tokens.json`
replace `mobile/design/tokens.json`. Daylight keeps its structure with the same new tokens.

## 9. Data and contract

Contract-first: `contracts/openapi.yaml` changes before backend and mobile.

```yaml
BodyType:    [HATCHBACK, SEDAN, ESTATE, SUV, COUPE, MPV, PICKUP]
PaintColor:  [WHITE, BLACK, SILVER, GREY, BLUE, RED, GREEN, BEIGE, BROWN, YELLOW, ORANGE, GOLD]
PaintFinish: [GLOSS, METALLIC, SATIN, MATTE]
WheelStyle:  [FIVE_SPOKE, MULTI_SPOKE, AERO]
RimColor:    [SILVER, BLACK, BODY]
GlassTint:   [LIGHT, DARK]
Plate:       string, 1–10 chars, ^[A-Z0-9](?:[A-Z0-9 -]{0,8}[A-Z0-9])?$
VehicleAppearance (object, no extra properties, every field optional):
  bodyType, color, colorHex (^#[0-9a-f]{6}$), finish, wheels, rimColor, glassTint, contrastRoof (boolean)
```

- `VehicleResponse` gains `plate: Plate | null` and `appearance: VehicleAppearance | null`.
- `UpdateVehicleRequest` gains `plate` (`null` clears it) and `appearance` (replaces the stored object).
- `RegisterVehicleRequest` is unchanged: the look is saved after the car exists (Q2).

**My calls here:** the look is grouped under one `appearance` object rather than flat `bodyType` and
`color` fields as Q11 first worded it; the registration request stays as it is.

**Backend work this needs, not planned here:** persist both fields; return `plate` only to the owner;
clear `plate` on transfer and release; keep `appearance` across transfers; leave `plate` out of passport
snapshots. Until that ships, the mobile work is proven against the fake API only.

**Migration of `viewerColorStore`:** the four old hexes map to `BLACK` (#0f1a15), `SILVER` (#d9dedb),
`GREEN` (#1c6b49), `RED` (#a3171d). The first time the home screen shows a car with no `appearance` and a
stored colour, the app saves `{ color }` to the server and deletes the stored key. A failed save leaves the
key for the next visit.

## 10. Phase 2

| # | Decision | By |
|---|----------|----|
| Q7 | **Scan the registration certificate** to fill in the journey: A = plate, E = VIN, D.1/D.3 = make/model, B = first registration, P.3 = fuel, R = colour, J = category. A second parser beside the invoice parser, reusing the OCR service. Ships after the manual journey. | owner |

## 11. Testing

Spec-driven as before: Gherkin first (`mobile/features/onboarding.feature`, `carcontext.feature`,
`look.feature`, and edits to `garage.feature`, `vehicle.feature`, `scanner.feature`, `passport.feature`),
steps through the real router against the fake API, which gains the new fields and validates them against
the contract. Unit tests for the VIN/WMI model, plate normalisation, nearest-colour mapping, the draft and
active-car stores, and the car kit's geometry. A manual device pass on one iPhone and one mid-range
Android: every body type holds 30 fps, both themes, large text.

## 12. Left to the builder

The WMI table's contents beyond the makes in the tests; the diagram drawings in "Where to find it";
skeleton shapes; exact animation timings within the design system's motion rule; how the grain image is
produced; the hue and lightness sliders' implementation.

## 13. Still open

- The buyer page and the PDF do not show the car's look yet. Whether they should is a product decision.
- Whether a pending claim should be visible anywhere other than the car list.
- Romanian copy for the journey.
