# Fuel & cost per km: mobile design

Date: 2026-11-17 · Scope: `mobile/` · Status: draft for approval
Parent spec (data, rules, endpoints): `2026-11-17-fuel-cost-design.md`. This file covers only what the user sees and how
the app talks to the API. Built from `mobile/src/shared/design` primitives and tokens.

## 1. Intent

Logging a fill-up must take about 10 seconds and one hand. The screens that come back are the reward: real consumption,
what the car costs per month and per km, and a warning when something looks wrong.

## 2. Goals / Non-goals

**Goals**
- Fast **Add fill-up** form, preconfigured from the car (fuel type, currency, last station, last km).
- **Fuel screen** per car: summary, charts, history, alert.
- Works for petrol, diesel, LPG and electric with the same screens (unit and a few fields change).

**Non-goals**
- **No receipt scan and no AI for fuel.** The form is manual. The existing scanner flow is unchanged.
- No total cost of ownership screen yet (backend spec, non-goal).
- No push notification for the alert. In-app card only.
- No offline queue for entries in v1 (the form needs the network like the event form does). Reads use the query cache.
- No export of fuel data from the screen (the account data export covers it).

**Anti-goals**
- A form that asks for more than it needs. Station, grade and note stay optional and collapsed.
- Numbers that look precise when the data is thin: show "not enough data yet", never `0.0`.
- Alarm for a car with a few entries. The alert appears only when the server sends it.

## 3. Decisions and my calls

1. **Entry point:** a **Fuel** row on the car screen (`CarHomeScreen`) opening `/vehicles/[vin]/fuel`, plus a primary
   "Add fill-up" button on that screen. No new tab.
2. **Any two of three.** Quantity, unit price and total: the user fills any two and the third is computed locally and
   shown as a hint-styled value. Last edited two win. Only `quantity` and `total` are sent.
3. **Defaults carry the speed.** Date today, km prefilled with `stats.lastOdometerKm`, fuel type from the car, currency
   and station from the last entry, "Full tank" ON.
4. **Fuel type from the car** (`vehicle.fuel`): `PETROL/DIESEL/LPG/ELECTRIC` map directly and the selector is hidden;
   `HYBRID` shows a two-way selector (Petrol / Electric) defaulting to Petrol; `OTHER` shows the selector with no
   default.
5. **Charts are drawn with `react-native-svg`** (already a dependency). No chart library; two small components
   (`LineChart`, `BarChart`) in `features/fuel/components/charts`, themed with tokens.
6. **Romanian first, English too**, through the existing `shared/i18n`. Number formats follow the device locale.

## 4. Screens

Routes: `app/vehicles/[vin]/fuel/index.tsx`, `fuel/new.tsx`, `fuel/[entryId].tsx` →
`features/fuel/components/*`.

### 4.1 Fuel screen (`FuelScreen`)

```
┌──────────────────────────────────────┐
│ ‹        Fuel                    +   │  AppBar, "+" = Add fill-up
├──────────────────────────────────────┤
│ [3 mo] [6 mo] [12 mo] [All]          │  FilterChip row (default 6 mo)
│ [ Petrol ] [ Electric ]              │  only when byFuelType has 2+
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ⚠ Consumption is up 22 %         │ │  AlertCard, only if stats.alert
│ │ 8.4 vs 6.9 L/100 km usual.       │ │
│ │ Could be tyres, a fault or       │ │
│ │ driving. Check it.               │ │
│ └──────────────────────────────────┘ │
│ ┌────────────┬────────────┐          │
│ │ 6.9        │ 0.52       │          │  StatTiles (2 x 2)
│ │ L/100 km   │ RON/km     │          │
│ │ average    │            │          │
│ ├────────────┼────────────┤          │
│ │ 412 RON    │ 7.18       │          │
│ │ this month │ RON/L avg  │          │
│ └────────────┴────────────┘          │
│ This month: 412 spent · about 560    │  month estimate line
│                                      │
│ Consumption         (line chart)     │
│ Cost per month      (bar chart)      │
│ Price per litre     (line chart)     │
│ Standard vs Premium (only if shown)  │
│                                      │
│ History                              │
│  14 Nov  Petrol  38.2 L  312 RON     │  tap → edit
│  27 Oct  ...                         │
└──────────────────────────────────────┘
```

- **Tiles:** average consumption (`avgConsumption`), cost per km, cost of the current month (`monthEstimate.spentSoFar`),
  average price (`avgUnitPrice`). A missing value shows `–` and a caption "Needs 2 full tanks" (consumption) or
  "Needs 2 fill-ups" (cost per km).
- **Month estimate line:** shown only when `projected` is non-null, labelled "about", never as a fact.
- **Alert card:** `warning` colour, icon `alert`, plain words and the two numbers. Tap scrolls to the consumption chart
  and marks the offending point. Dismiss is not offered: it goes away on its own when the next full tank is normal.
- **Consumption chart:** `points` with `consumption != null`, x by date, y in L/100 km (or kWh/100 km). Dots, thin line,
  the alert point in `warning`. Tap a dot → small tooltip (date, value, km). Fewer than 2 points → `EmptyState`
  "Fill up completely twice to see consumption".
- **Cost chart:** `monthly[]` as bars, last 6 or 12 months by selected period, current month hatched/lighter because
  it is incomplete.
- **Price chart:** `points[].unitPrice`, all entries.
- **Grade comparison:** a small two-row card (Standard / Premium: avg consumption, number of tanks) with a neutral
  caption "Based on N and M tanks". No "premium is worth it" verdict.
- **History:** newest first, infinite scroll by cursor (`listFuelEntries`). Row: date, fuel type icon, quantity+unit,
  total; second line: station · grade · consumption if present. Swipe or tap into edit.
- States: `Skeleton` while loading, `ErrorState` with retry, `OfflineBanner` when offline, first-use `EmptyState` with
  the Add button ("Add your first fill-up. Takes 10 seconds.").

### 4.2 Add / edit fill-up (`FuelFormScreen`)

```
┌──────────────────────────────────────┐
│ ‹        Add fill-up                 │
├──────────────────────────────────────┤
│ Odometer (km)      [ 84 210        ] │  numeric, autofocus, prefilled
│ Quantity (L)       [ 38.20         ] │
│ Total (RON)        [ 312.00        ] │
│ Price / L          [ 8.17  computed] │  muted, editable
│                                      │
│ ( ● ) Full tank                      │  Switch, default ON
│                                      │
│ ▸ More details                       │  collapsed
│    Date        [ today ]             │  (date is above the fold only
│    Grade       [Standard][Premium]   │   if changed often: no, it is
│    Station     [ Petrom       ]      │   here, today by default)
│    Note        [              ]      │
│    ☐ I missed a fill-up before this  │
│                                      │
│ [          Save fill-up            ] │  ActionBar
└──────────────────────────────────────┘
```

- **Above the fold:** odometer, quantity, total, computed price, Full tank. Everything else under **More details**.
  The date chip ("Today") sits next to the AppBar title and opens the existing `DateField` sheet.
- **Any-two-of-three:** the field the user did **not** touch last is the computed one (muted style, still editable).
  Rounding: total to 2 decimals, price to 3 in the UI. If the user edits all three inconsistently, the last two edited
  win and the third is recomputed. Recompute is local and instant.
- **Electric:** labels become kWh and "Price / kWh"; Grade is replaced by **Charging** (Home / Public AC / Fast DC).
- **Validation (inline, on blur and on submit):** quantity > 0; total >= 0; odometer integer >= 0; odometer below the
  last known km shows a non-blocking hint "Lower than your last reading (84 210)" and the server's
  `odometer-inconsistent` 422 is shown on the field. A quantity above a sane tank (more than 200 L or 150 kWh) asks
  "Are you sure?" once.
- **Missed fill-up checkbox** has a one-line help: "Tick it if you did not log the previous fill-up. We will not
  calculate consumption across the gap."
- **Partial fill:** turning Full tank OFF shows the caption "Consumption is calculated between full tanks."
- **Save:** disabled until the required fields are valid. On success: toast "Saved", go back, invalidate
  `qk.fuel(vin)` and `qk.fuelStats(vin)`. On `consent-required` the existing app-wide handler applies.
- **Edit mode** (`fuel/[entryId]`): same form, plus a **Delete** action in `ConfirmSheet`. Editing and deleting refetch
  stats.
- After saving, if the new entry closes an included segment, the toast reads "Saved · 6.8 L/100 km" using the new
  point's `consumption` from the refetched stats (best effort, silent if absent).

## 5. Code structure (`mobile/src/features/fuel`)

```
fuel/
├── api/      useFuelEntries (infinite), useFuelStats, useAddFuelEntry, useUpdateFuelEntry, useDeleteFuelEntry
├── model/    fuelForm.ts          form state, any-two-of-three maths, request builder, validation
│             fuelDefaults.ts      fuel type from vehicle.fuel, currency/station/km defaults
│             fuelDisplay.ts       units, number/currency formatting, labels
│             chartData.ts         stats -> chart series (pure)
├── components/  FuelScreen, FuelFormScreen, FuelRow, StatTile, AlertCard, GradeComparisonCard,
│                charts/LineChart, charts/BarChart
└── index.ts
```

- Types come from `shared/api/generated/schema` after regenerating from `contracts/openapi.yaml` (same flow as
  `deadlines`). Never hand-write API types.
- Query keys: add `qk.fuel(vin)` and `qk.fuelStats(vin, period)` to `shared/api`. Mutations invalidate both.
- Hooks mirror `useAddEvent` / `useDeadlines`. `meta: { vin }` as elsewhere.
- Logic lives in `model/` as pure functions with tests, so components stay thin.
- Integrations: row on `CarHomeScreen`; `i18n` strings under `fuel.*`; icon additions to `primitives/Icon.tsx`
  (`fuel`, `bolt`, `chart`) with the existing icon test updated.

## 6. Accessibility and feel

- Inputs are 48 dp high, numeric keyboards (`decimal-pad` / `number-pad`), `returnKeyType="next"` through the fields,
  Save reachable with the keyboard open (`ActionBar` above it).
- Charts are not the only carrier of meaning: each has a text summary line for screen readers ("Consumption, average
  6.9, latest 8.4") and the tiles hold the same numbers.
- The alert and "more" states never rely on colour alone (icon + words).
- Haptic tick on save (existing helper), none on errors.

## 7. Testing

- **Unit (jest):** `fuelForm` (every pair of the three fields, rounding, last-two-win, electric labels, request
  builder omits derived price), `fuelDefaults` (all `FuelType` values, hybrid, other), `chartData` (gaps, single point,
  alert point flag), `fuelDisplay` (locale formatting).
- **Component tests:** form validation messages and the 422 mapping; `FuelScreen` states (loading, empty, error, data,
  alert, two fuel types); collapsed/expanded More details; delete confirmation.
- **Behaviour (`mobile/features/fuel.feature`, Gherkin like the existing ones):** add a fill-up in under five taps from
  the car screen; electric car shows kWh and Charging; partial fill-up does not produce consumption; alert card shown
  from a stats fixture; premium comparison hidden with too little data.
- Lint, typecheck and the existing design-system tests stay green.

## 8. Open questions for the owner

1. **Entry point:** a row on the car screen as proposed, or a shortcut button on the car header next to the bell?
2. **Date above the fold or in More details?** Proposed: a "Today" chip in the header, rest collapsed.
3. **Show the month estimate** ("about 560 RON") at all? It is useful but easy to misread early in the month; the
   server returns `null` until three entries in the last 60 days.
4. **Comparison card** premium vs standard: keep, or leave out of v1?
