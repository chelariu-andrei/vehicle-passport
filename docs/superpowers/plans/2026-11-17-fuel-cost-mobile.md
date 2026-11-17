# Fuel & Cost per km: Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Fuel screen per car (summary tiles, alert, charts, history) and a 10-second Add fill-up form.

**Architecture:** A new `features/fuel` module: pure `model/` functions (form maths, defaults, formatting, chart data) tested first; thin TanStack Query hooks over the generated API types; screens built from `shared/design` primitives; charts drawn with `react-native-svg`.

**Tech Stack:** Expo, expo-router, TanStack Query, openapi-fetch (generated types), react-native-svg (already installed), jest + jest-cucumber.

**Spec:** `docs/superpowers/specs/2026-11-17-fuel-cost-mobile-design.md` (screens) and `2026-11-17-fuel-cost-design.md` (data and endpoints). Backend plan: `2026-11-17-fuel-cost-backend.md`; its Task 1 (contract) must be merged first.

## Global Constraints

- API types come only from `src/shared/api/generated/schema.d.ts` (`npm run gen:api`); never hand-write them. `npm run check:contract` must pass.
- No receipt scan, no AI, no new dependency. Charts are `react-native-svg`.
- Only `quantity` and `total` are sent for the amounts; the unit price is computed locally for display and never sent.
- Defaults: date today, km = `stats.lastOdometerKm`, fuel type from the car, currency and station from the last entry, Full tank ON. Hidden by default under "More details": date (a "Today" chip sits in the header), grade, station, note, "I missed a fill-up before this".
- Fuel type from `vehicle.fuel`: `PETROL/DIESEL/LPG/ELECTRIC` direct with selector hidden; `HYBRID` selector Petrol/Electric defaulting to Petrol; `OTHER` selector with no default.
- Electric: units kWh, label "Price / kWh", Grade replaced by Charging (Home / Public AC / Fast DC).
- Confirm "Are you sure?" once when quantity is above 200 L or 150 kWh. Lower-than-last-reading km is a non-blocking hint; the server's `odometer-inconsistent` 422 shows on the km field.
- Stats period chips: 3 mo / 6 mo / 12 mo / All, default 6 mo. A missing number renders `–` with a caption ("Needs 2 full tanks" for consumption, "Needs 2 fill-ups" for cost per km), never `0`.
- Alert card appears only when `stats.byFuelType[].alert` is non-null; it has no dismiss.
- Month estimate line only when `monthEstimate.projected` is non-null, worded "about".
- Strings in `src/shared/i18n/en.ts` under `fuel.*` (and `ro.ts` if it is already populated for sibling features); touch targets 48 dp; numeric keyboards (`decimal-pad` / `number-pad`); decimal comma input must parse.
- `test/operations-covered.test.ts` requires every contract operation to be called by a feature: Task 4 consumes the five fuel operations.

## Review Focus

- Decimal comma ("38,2") and trailing separators in quantity, total and price fields parse correctly (Task 2).
- Editing the same field twice, or all three amount fields inconsistently: the last two edited win, nothing becomes `NaN` (Task 2).
- A car with no entries and a car with one entry show the empty state, not charts of nothing and no `0.0` (Task 7).
- Offline: the form is blocked with the existing offline banner, reads show cached data (Tasks 6, 7).
- Hybrid and OTHER cars: switching fuel type in the form switches unit labels and the Grade/Charging field without losing typed numbers (Task 6).

---

### Task 1: Types, query keys, test fakes

**Files:**
- Modify: `mobile/src/shared/api/queryKeys.ts` (add `fuel(vin)`, `fuelStats(vin, period)`), `mobile/test/fake-api/handlers.ts`, `mobile/test/fake-api/builders.ts` (+ `contract.ts` if it lists operations)
- Regenerate: `mobile/src/shared/api/generated/schema.d.ts`

**Interfaces:**
- Produces: `qk.fuel(vin) => ['fuel', vin]`, `qk.fuelStats(vin, period: string) => ['fuel', vin, 'stats', period]` (stats under `fuel(vin)` so one invalidate refreshes both); fake-api handlers for the five operations over an in-memory list with a `fuelEntryBuilder()` and `fuelStatsBuilder()` in `builders.ts`.

- [ ] **Step 1:** Run `npm run gen:api` (no-op if the backend plan's Task 1 already regenerated). Add the keys and extend `fake.test.ts` with one test per new handler (`fake_fuel_entries_roundtrip`, `fake_fuel_stats_returns_builder_defaults`). Run `npx jest test/fake-api`. Expected: FAIL, then implement handlers, then PASS.
- [ ] **Step 2:** Commit `test(fuel): fake API and query keys`.

### Task 2: Form model (any two of three)

**Files:**
- Create: `mobile/src/features/fuel/model/fuelForm.ts`
- Test: `mobile/src/features/fuel/model/fuelForm.test.ts`

**Interfaces:**
- Produces:
  - `type AmountField = 'quantity' | 'unitPrice' | 'total'`
  - `type FuelFormState = { date: string; odometerKm: string; fuelType: FuelEntryType | null; quantity: string; unitPrice: string; total: string; touched: AmountField[]; fullTank: boolean; missedPrevious: boolean; grade: FuelGrade | null; chargeType: ChargeType | null; station: string; note: string; currency: string }`
  - `parseDecimal(raw: string): number | null` (accepts `,` and `.`, trims, rejects empty/NaN/negative)
  - `editAmount(state: FuelFormState, field: AmountField, raw: string): FuelFormState` (records `touched` as the last two distinct fields; recomputes the third)
  - `validateFuelForm(state, ctx: { lastKm: number | null; isElectric: boolean }): { errors: Partial<Record<keyof FuelFormState, string>>; hints: { odometer?: string }; confirmLargeQuantity: boolean }`
  - `toFuelEntryRequest(state): FuelEntryRequest` (sends `quantity`, `total`, no unit price; omits `grade` for electric and `chargeType` for liquid fuels; omits empty station/note)

- [ ] **Step 1:** Write failing tests: every pair of the three fields yields the third (`quantity 38.2 + total 312` -> unit price `8.168`; `quantity 38.2 + unitPrice 8.17` -> total `312.09`; `unitPrice 8.17 + total 312` -> quantity `38.2`); last two edited win on a third edit; `"38,2"` parses to 38.2; `"38,"` and `""` return null; quantity `0` invalid; large quantity sets `confirmLargeQuantity` (201 L yes, 200 L no; kWh limit 150); km below `lastKm` gives the hint, not an error; request builder omits `unitPrice`, electric omits `grade`.
- [ ] **Step 2:** Run `npx jest src/features/fuel/model/fuelForm.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the functions. Rounding: total to 2 decimals, unit price to 3, quantity to 3.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): form model`.

### Task 3: Defaults and display formatting

**Files:**
- Create: `mobile/src/features/fuel/model/fuelDefaults.ts`, `fuelDisplay.ts`; add `fuel.*` strings to `src/shared/i18n/en.ts` (and `ro.ts` as the sibling features do); add icons `fuel`, `bolt`, `chart` to `src/shared/design/primitives/Icon.tsx`
- Test: `fuelDefaults.test.ts`, `fuelDisplay.test.ts`, and the existing `primitives.test.tsx` icon list

**Interfaces:**
- Produces:
  - `fuelTypeChoice(vehicleFuel: VehicleFuel): { options: FuelEntryType[]; default: FuelEntryType | null }` (PETROL -> `[PETROL]`, HYBRID -> `[PETROL, ELECTRIC]` default PETROL, OTHER -> all four, default null)
  - `initialForm(args: { vehicleFuel; lastEntry: FuelEntryResponse | null; lastKm: number | null; today: string }): FuelFormState`
  - `unitOf(t: FuelEntryType): 'L' | 'kWh'`, `consumptionUnit(t): 'L/100 km' | 'kWh/100 km'`, `formatMoney(amount: number, currency: string, locale: string): string`, `formatQuantity(q: number, unit): string`, `formatConsumption(v: number | null, t): string` (`–` for null)

- [ ] **Step 1:** Write failing tests for every `VehicleFuel` value, for `initialForm` with and without a last entry (currency/station carry over, km prefilled, `fullTank` true), and for formatting in `en` and `ro` locales.
- [ ] **Step 2:** Run `npx jest src/features/fuel/model src/shared/design`. Expected: FAIL.
- [ ] **Step 3:** Implement; reuse the existing `Icon` SHAPES style for the three icons.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): defaults, formatting, strings, icons`.

### Task 4: API hooks

**Files:**
- Create: `mobile/src/features/fuel/api/useFuelEntries.ts` (infinite, cursor), `useFuelStats.ts`, `useAddFuelEntry.ts`, `useUpdateFuelEntry.ts`, `useDeleteFuelEntry.ts`, `mobile/src/features/fuel/index.ts`
- Test: `mobile/src/features/fuel/api/fuelHooks.test.tsx` (same harness style as `useDeadlines.test.ts`)

**Interfaces:**
- Consumes: `qk.fuel`, `qk.fuelStats`, fake-api.
- Produces: `useFuelStats(vin: string, period: '3m' | '6m' | '12m' | 'all')`, `useFuelEntries(vin: string)`, `useAddFuelEntry(vin)`, `useUpdateFuelEntry(vin, entryId)`, `useDeleteFuelEntry(vin, entryId)`; all mutations `meta: { vin }` and invalidate `qk.fuel(vin)` in `onSettled`.

- [ ] **Step 1:** Write failing hook tests: stats are fetched with the period param; adding an entry invalidates both list and stats; a 422 `odometer-inconsistent` surfaces through `ApiError` with its `code`; list pages follow `nextCursor`.
- [ ] **Step 2:** Run `npx jest src/features/fuel/api`. Expected: FAIL.
- [ ] **Step 3:** Implement hooks mirroring `useAddEvent` and `useDeadlines`.
- [ ] **Step 4:** Run the tests plus `npx jest test/operations-covered.test.ts`. Expected: PASS (the five operations are now consumed).
- [ ] **Step 5:** Commit `feat(fuel): api hooks`.

### Task 5: Chart data and chart components

**Files:**
- Create: `mobile/src/features/fuel/model/chartData.ts`, `mobile/src/features/fuel/components/charts/LineChart.tsx`, `BarChart.tsx`
- Test: `chartData.test.ts`, `charts.test.tsx`

**Interfaces:**
- Produces:
  - `consumptionSeries(points: StatsPoint[], alertEntryId: string | null): { x: number; y: number; label: string; flagged: boolean }[]` (only points with a consumption value)
  - `priceSeries(points): same shape`, `monthlyBars(monthly: MonthCost[], period): { label: string; value: number; partial: boolean }[]` (current month `partial: true`)
  - `<LineChart series ariaSummary onPointPress />`, `<BarChart bars ariaSummary />`; themed with design tokens, no chart library; both expose `accessibilityLabel={ariaSummary}`.

- [ ] **Step 1:** Write failing tests: single point and empty list give empty or one-point series without throwing; flagged point matches the alert entry; current month bar is `partial`; chart components render with 0, 1 and many points and carry the summary label.
- [ ] **Step 2:** Run `npx jest src/features/fuel/model/chartData.test.ts src/features/fuel/components/charts`. Expected: FAIL.
- [ ] **Step 3:** Implement with `react-native-svg` (`Svg`, `Polyline`, `Circle`, `Rect`, `Text`); scale to the data min/max with padding.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): chart data and charts`.

### Task 6: Add / edit fill-up screen

**Files:**
- Create: `mobile/src/features/fuel/components/FuelFormScreen.tsx`; routes `mobile/app/vehicles/[vin]/fuel/new.tsx`, `mobile/app/vehicles/[vin]/fuel/[entryId].tsx`
- Test: `mobile/test/steps/fuel.form.test.tsx` (harness like `event.check.test.tsx`)

**Interfaces:**
- Consumes: Tasks 2, 3, 4; `DateField`, `ConfirmSheet`, `Switch`, `Field`, `ActionBar`, `toast`.
- Produces: the form per spec §4.2; edit mode loads the entry and adds a Delete action behind `ConfirmSheet`.

- [ ] **Step 1:** Write failing tests: km is prefilled from stats; typing quantity and total shows the computed price; saving posts only `quantity` and `total`; Save disabled until required fields are valid; Full tank off shows the caption; a 422 `odometer-inconsistent` shows under the km field and keeps the form; hybrid car switches labels and Grade/Charging when fuel type changes without clearing typed numbers; electric car shows kWh and Charging; large quantity opens the confirmation once; More details collapsed by default; delete asks for confirmation; offline shows the banner and blocks Save.
- [ ] **Step 2:** Run `npx jest test/steps/fuel.form.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement the screen and routes. Save: toast, `router.back()`, mutation invalidates stats; after success, if the refetched point has a consumption value, toast reads "Saved · {value} {unit}".
- [ ] **Step 4:** Run the test and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): add and edit fill-up screen`.

### Task 7: Fuel screen

**Files:**
- Create: `mobile/src/features/fuel/components/FuelScreen.tsx`, `StatTile.tsx`, `AlertCard.tsx`, `GradeComparisonCard.tsx`, `FuelRow.tsx`; route `mobile/app/vehicles/[vin]/fuel/index.tsx`
- Test: `mobile/test/steps/fuel.screen.test.tsx`

**Interfaces:**
- Consumes: Tasks 3 to 5; `FilterChip`, `EmptyState`, `ErrorState`, `Skeleton`, `OfflineBanner`, `AsyncList`.
- Produces: the screen per spec §4.1: period chips, fuel-type chips when `byFuelType.length > 1`, alert card, four tiles, month estimate line, three charts, grade card, paginated history, AppBar "+" to `/vehicles/{vin}/fuel/new`, row tap to `/vehicles/{vin}/fuel/{id}`.

- [ ] **Step 1:** Write failing tests: loading shows skeletons; a car with no entries shows the empty state with an Add button and no charts; one entry shows tiles with `–` and the captions and no consumption chart; alert fixture renders the card with both numbers; no alert key renders no card; `projected: null` hides the estimate line; two fuel types render the chips and switch the content; grade card absent when `gradeComparison` is empty; error state retries; changing the period refetches with the new period; history shows consumption on the closing entry only.
- [ ] **Step 2:** Run `npx jest test/steps/fuel.screen.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement the components; each chart has the text summary for screen readers.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fuel): fuel screen`.

### Task 8: Car screen entry point

**Files:**
- Modify: `mobile/src/features/vehicle/components/CarHomeScreen.tsx` (a "Fuel" row linking to `/vehicles/{vin}/fuel`)
- Test: extend the existing car-home test under `mobile/test/steps/` (find it with `grep -l CarHomeScreen`) 

**Interfaces:**
- Consumes: Task 7 route, `useFuelStats` for an optional subtitle ("6.9 L/100 km" when available; nothing while loading or failing).

- [ ] **Step 1:** Add a failing test: the car screen shows the Fuel row and tapping it pushes `/vehicles/{vin}/fuel`; no subtitle while stats load.
- [ ] **Step 2:** Run it. Expected: FAIL. Implement the row. Run again. Expected: PASS.
- [ ] **Step 3:** Commit `feat(fuel): fuel entry on the car screen`.

### Task 9: Behaviour spec and final check

**Files:**
- Create: `mobile/features/fuel.feature`, `mobile/test/steps/fuel.steps.tsx` (follow `deadlines.steps.tsx` and `deadlines.feature`)
- Modify: `mobile/README.md` or the features index only if one exists (check `mobile/features`)

**Interfaces:**
- Produces: scenarios from spec §7: a fill-up is added in under five taps from the car screen; an electric car shows kWh and Charging; a partial fill-up produces no consumption; the alert card appears from a stats fixture; the premium/standard comparison is hidden with too little data.

- [ ] **Step 1:** Write the feature and steps. Run `npx jest test/steps/fuel.steps.tsx`. Expected: FAIL (undefined steps), then implement, then PASS.
- [ ] **Step 2:** Run `npm run check` (typecheck, lint, contract, licenses, all tests). Expected: all pass.
- [ ] **Step 3:** Commit `test(fuel): behaviour scenarios`.

---

## Self-review

- **Spec coverage:** entry point (8), form and defaults (2, 3, 6), fuel type rules (3), stats screen with tiles/alert/charts/history/grade (5, 7), empty and error states (7), accessibility summaries (5, 7), Gherkin (9), contract consumption (4). Open questions in the mobile spec are resolved with the proposed defaults in Global Constraints; changing them affects Tasks 6 and 7 only.
- **Types:** `FuelFormState`, `AmountField`, `StatsPoint`, `MonthCost` are defined once (Tasks 2, 5) and reused by name.
- **Proportion:** tasks list tests, signatures and the spec values; component bodies are left to the implementer.
