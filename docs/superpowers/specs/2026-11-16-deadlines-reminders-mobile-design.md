# Deadlines & reminders: mobile design (notification icon, Document status screen)

Date: 2026-11-16 · Scope: `mobile/` · Status: draft for approval
Parent spec: `2026-11-16-deadlines-reminders-design.md` (data, endpoint, reminder plan). This file covers only what the
user sees, built from the app's design system in `mobile/src/shared/design` (primitives and tokens).

"Design components" here means those primitives: `Screen`, `AppBar`, `Icon`, `Card`, `SettingsGroup`, `SettingsRow`,
`Switch`, `Text`, `Button`, `ActionBar`, `EmptyState`, `ErrorState`, `Skeleton`, `OfflineBanner`, `toast`, and the
colour / spacing / radius tokens. Nothing outside that set is introduced except two small additions in §3.

## 1. Notification icon on the car screen

**Where.** In the header of `CarHomeScreen` (the `right` slot of `Header`), to the **left of the existing "more"
button**. It belongs to the active car, so it lives on the Car tab, not in the tab bar.

```
┌──────────────────────────────────────┐
│  [ Car name ▾ ]            🔔●2   ⋯  │   bell with badge · overflow
├──────────────────────────────────────┤
```

- Control: `Pressable`, 48 × 48 (same as the overflow button), `accessibilityRole="button"`.
- Glyph: `<Icon name="bell" />`. **The icon bundle has no bell yet**: add `bell` to `SHAPES` in
  `primitives/Icon.tsx` (24 × 24 grid, stroked, same style as `shield` and `alert`):
  `{ d: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z' }` and `{ d: 'M10 20.5a2 2 0 0 0 4 0' }`. The icon test
  (`primitives.test.tsx`, `iconNames`) covers it.
- Badge: a count in a small pill at the top-right of the glyph (see §3). The count is the number of documents that are
  `EXPIRING` or `EXPIRED` for the active car.
  - 0 → no badge, plain bell.
  - ≥ 1 and none expired → `warning` colour. Any expired → `danger` colour.
  - Over 9 shows `9+` (there are only six documents, so this is a safeguard).
- Tap → push `/vehicles/{vin}/deadlines` (the Document status screen).
- Accessibility: label "Document status", value "2 documents need attention" (or "All documents in order" when
  none). Colour is never the only cue: the **count** carries the meaning, and the screen shows icon + word per row.
- Loading and errors: while `useDeadlines` loads or fails, the bell shows **no badge** (never a stale or guessed
  count). It stays tappable; the screen handles its own error.

## 2. Document status screen

Route `app/vehicles/[vin]/deadlines.tsx` → `features/deadlines/components/DeadlinesScreen`.

```
┌──────────────────────────────────────┐
│ ‹        Document status             │  AppBar
├──────────────────────────────────────┤
│ Dacia Duster · B 123 ABC             │  caption
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ◉ ITP              ● Valid       │ │  green
│ │   until 12 Mar 2027 · 116 days   │ │
│ ├──────────────────────────────────┤ │
│ │ ◉ RCA              ▲ Expiring    │ │  yellow
│ │   until 28 Nov 2026 · 12 days    │ │
│ ├──────────────────────────────────┤ │
│ │ ◉ CASCO            ○ Not added   │ │  grey, "optional"
│ │   Optional · Add                 │ │
│ ├──────────────────────────────────┤ │
│ │ ◉ Rovinietă        ✕ Expired     │ │  red
│ │   expired 3 days ago             │ │
│ │ …fire extinguisher, first-aid kit│ │
│ └──────────────────────────────────┘ │
│                                      │
│ Reminders: 30, 7 and 1 day before    │
│ [ Notification settings ]            │  secondary Button
└──────────────────────────────────────┘
```

- Layout: `Screen` (scroll) with `AppBar` (title "Document status", back). One `SettingsGroup` of six rows, in the fixed
  order of the endpoint.
- Row = `SettingsRow` with a leading `Icon`, the document name, a **status pill**, and a second line (date and days).
  Icons from the existing bundle: ITP `car`, RCA `shield`, CASCO `shield`, rovinietă `doc`, fire extinguisher `alert`,
  first-aid kit `plus`. (Builder may swap if a clearer existing glyph fits.)
- Status pill (new, §3): shape + word + colour, like `EvidenceBadge`:

| Status | Glyph | Word | Colour token |
|---|---|---|---|
| `VALID` | `check` | Valid | `brand` |
| `EXPIRING` | `clock` | Expiring | `warning` |
| `EXPIRED` | `alert` | Expired | `danger` |
| `UNKNOWN` | `clock`, dashed border | No expiry date | `evidence-estimated` |
| `NOT_RECORDED` | none, dashed border | Not added | `evidence-estimated` |

- Second line copy: `VALID`/`EXPIRING` "until {date} · {n} days"; `EXPIRED` "expired {n} days ago"; `UNKNOWN` "Add
  the expiry date"; `NOT_RECORDED` "Add" (CASCO: "Optional · Add").
- Tap a row:
  - has `eventId` → the event detail screen;
  - `NOT_RECORDED` / `UNKNOWN` → the new-event form with the type pre-selected (`events/new?type=INSURANCE` etc., using
    the registry from the timeline spec §8.1; RCA/CASCO also pre-select `coverage`).
- Footer: caption showing the active reminder days (from settings) or "Reminders are off" when
  `documentDeadlines` is false, and a secondary `Button` "Notification settings" → `/account/notifications`.
- States: `Skeleton` rows while loading; `ErrorState` with retry; `OfflineBanner` when offline (show last data if
  cached); no `EmptyState` is needed because the six rows always exist.
- The status data refetches on focus (`useRefetchOnFocus`), so returning from the form shows the renewal.

## 3. New design-system additions (two, both small)

1. **`Icon` `bell`** (§1).
2. **`StatusPill`** primitive in `primitives/` (glyph + word + token colour, optional dashed border). It reuses the look
   rules of `EvidenceBadge` (`EvidenceBadge.tsx`: border 1.5, `radius-sm`, `space-1` / `space-2` padding). Props:
   `{ tone: 'ok' | 'warn' | 'bad' | 'muted'; label: string; icon?: IconName; dashed?: boolean }`. Tone maps to colour
   tokens `brand` / `warning` / `danger` / `evidence-estimated`. Exported from `shared/design/index.ts`.
3. **`CountBadge`**: the bell's pill. Props `{ count: number; tone: 'warn' | 'bad' }`; hidden when `count` is 0. Text is
   `caption`-sized, minimum 18 × 18, `radius-pill`, colour from the tone with the matching on-colour text for contrast.

Both are tested for the colour/tone mapping, in dark and light themes (contrast of `warning` and `danger` on `surface`
already exists in both token sets).

## 4. Notification settings screen (existing, extended)

`features/settings/components/NotificationsScreen.tsx` already has the deadline switch and the 30 / 7 / 1 chips.

- Add a `Switch` "Tire-season reminders" under the "Reminders" group, bound to `notifications.tireSeason`, with a
  caption "Winter tires on 15 October, summer tires on 1 April".
- When the OS permission is **denied**, show a caption under the group and a `Button` "Open system settings" (calls
  `Linking.openSettings()`). The switches stay usable; they just cannot deliver until permission is granted.
- The first time the user turns on a reminder or the scheduler would schedule one, show a short explanation (a
  `ConfirmSheet` with "Allow reminders" / "Not now") **before** the system prompt.

## 5. Notification content and tap

- Title and body from `en.deadlines.notification` (parent spec §5.3). The car name is in the body, because the app can
  hold several cars.
- Data payload: `{ vin, kind }`. Tapping opens `/vehicles/{vin}/deadlines` through the notification response listener
  registered at the app root. If the user is signed out, the route guard sends them to sign-in and then on to the
  target (builder: check how existing deep links behave and match).
- Android channel `deadlines`, default importance.

## 6. Files (mobile)

```
app/vehicles/[vin]/deadlines.tsx                       thin route
src/features/deadlines/
  api/useDeadlines.ts                                   GET /vehicles/{vin}/deadlines
  model/reminderPlan.ts                                 pure plan (parent §5.3)
  model/documentRegistry.ts                             kind → label key, icon, optional flag, new-event preset
  notifications/scheduler.ts                            cancel-all + schedule (wraps expo-notifications)
  notifications/useReminderSync.ts                      triggers: start, foreground, event change, settings change
  components/DeadlinesScreen.tsx
  components/DeadlineRow.tsx
  components/DeadlinesBell.tsx                          bell + CountBadge, used by CarHomeScreen
  index.ts
src/shared/design/primitives/StatusPill.tsx, CountBadge.tsx
src/shared/design/primitives/Icon.tsx                   + bell
src/shared/i18n/en.ts                                   + deadlines.*, settings.notifications.tireSeason
```

`DeadlinesBell` is exported through the feature `index.ts`; `CarHomeScreen` imports it from there (features talk
through their public index, as `HistoryList` does).

## 7. Testing

- `StatusPill`, `CountBadge`: tone → colour, dashed variant, hidden at 0, accessibility label.
- `DeadlinesBell`: no badge when loading/error/0; warn vs bad tone; count; label and value text.
- `DeadlinesScreen`: six rows in order for each status; CASCO shows "Optional · Add"; row tap targets (event vs new
  form with preset); skeleton, error and offline states; footer text with reminders on and off.
- `NotificationsScreen`: tire-season switch persists; denied-permission note and button.
- `reminderPlan`, `scheduler`, `useReminderSync`: as the parent spec §9.
- Manual (document in the e2e checklist next to the account one): grant, deny, then grant from system settings; change
  the device date to cross a reminder; reinstall and sign in.

## 8. Left to the builder

- The exact `bell` path tweaks after seeing it next to the other glyphs at 24 px.
- Whether `StatusPill` and `CountBadge` merge into one primitive if they end up near-identical.
- Romanian copy once `ro` strings exist.
