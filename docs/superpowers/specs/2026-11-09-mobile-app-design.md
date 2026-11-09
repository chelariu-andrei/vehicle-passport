# Mobile app design — vehicle-passport (v1)

Date: 2026-11-09 · Scope: `mobile/` and a small buyer web page in `web/` · Status: draft for approval
Companions: `2026-11-09-mobile-api-integration.md` (endpoint behaviour), `PRODUCT.md` (product context),
design system artifact https://claude.ai/artifact/4744YKEHgeUzJgtoCZ3J3Y

Decisions are labelled **user** (decided by the product owner) or **my call** (open to change).

## 1. Intent

A car owner keeps a trustworthy history of their car on their phone, by typing entries or scanning
invoices, and hands a buyer a frozen, verifiable passport when selling. The app should feel like a
premium car brand's own app: the car is the hero, the paperwork is effortless, and how far each fact can
be trusted is always visible.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Sign in and manage a garage, including ownership claims.
2. Show a car's full history, with its evidence level on every entry.
3. Add, edit and delete entries by hand.
4. Photograph one invoice or up to 20, review the extracted values, and confirm or reject each.
5. Create, share, and revoke passports (link, QR, PDF).
6. A 360° car stage on the vehicle screen.
7. A read-only web page where a buyer who scans the QR reads the passport, without the app (**user**).

**Non-goals (v1):** buyer or service-shop accounts; notifications; offline writes; health score; payments;
user-captured 360 photos; backend changes; a tablet-specific layout; PDF or multi-page invoice scanning
(**user**); password reset and social sign-in (**user**); public store release (**user**).

**Anti-goals**
- A scanned value becoming DOCUMENTED without an explicit confirm.
- Any screen implying a level of trust the data doesn't have. In particular, nothing may say "verified"
  unless the API returned `VERIFIED`. The passport hash proves integrity, not authenticity.
- Showing owner or claimant identity anywhere in shared or historic data.
- Web-shaped UI on a phone: reinvented back gestures, hover affordances, fake native controls.

## 3. Constraints

- Expo with expo-router, in the existing `mobile/` folder (**user**). `mobile/` holds only `.gitkeep` today.
- iOS and Android from one codebase, each following its own navigation conventions (**user**).
- Primary user is the owner (**user**).
- Black and green, premium and friendly (**user**); the design system above is the visual source of truth.
- `contracts/openapi.yaml` is the source of truth for the API. Contract-first (project rule).
- The 3D car is a generic reference model, tinted, with no backend support (**user**).
- Spec-driven: behaviour is specified in Gherkin before code, as on the backend (**user**, "SDD").
- Release target is internal testing: dev builds, then TestFlight and the Play internal track (**user**).
  TestFlight needs a paid Apple Developer account and, from Windows, EAS cloud builds.
- Email and password only (**user**). Hosted Supabase must keep email confirmation **off**, or sign-up
  returns no session. A forgotten password is reset by an admin in Supabase.
- UI copy is English, with strings in a catalog so Romanian can be added (**my call**).

## 4. Technical decisions

| Decision | Choice | By |
|---|---|---|
| Framework | Expo (latest stable SDK at build time), expo-router, TypeScript strict | user / my call |
| API client | `openapi-typescript` + `openapi-fetch`, generated from the contract | my call |
| Server state | TanStack Query | my call |
| Auth | `@supabase/supabase-js` with encrypted session storage | backend's Supabase JWT; client = my call |
| Forms | `react-hook-form` + `zod` | my call |
| Local persistence | AsyncStorage for the scan-job store, claim store, and viewer colours | my call |
| Styling | `StyleSheet` reading typed tokens generated from the design system's `tokens.json` | my call |
| Fonts | Sora, Figtree, JetBrains Mono, bundled via `@expo-google-fonts/*` | my call |
| Icons | Authored VP set for brand moments; system chrome from SF Symbols / Material Symbols | my call |
| Capture | `expo-image-picker` (camera, library), `expo-image-manipulator` (JPEG, resize) | my call |
| Files | `expo-file-system`, `expo-sharing`, `expo-image` (authenticated QR), `expo-web-browser` (buyer page) | my call |
| Tests | Jest, React Native Testing Library, `jest-cucumber`, MSW-style fake API | my call |
| Buyer page | One server-rendered route in `web/`, with its data fetched on the server; runtime left to the builder | user / my call |

## 5. Structure

Feature-first, mirroring the backend's packages. Route files stay thin.

```
mobile/
├── app/                        # expo-router routes only
├── features/                   # Gherkin .feature files
├── src/
│   ├── features/
│   │   ├── auth/  vehicle/  event/  scan/  passport/
│   │   │   ├── api/            # query and mutation hooks
│   │   │   ├── components/
│   │   │   └── model/          # parsing, mapping, local stores
│   └── shared/
│       ├── api/                # client, generated types, auth middleware, problem mapping
│       ├── design/             # tokens, theme, primitives (Button, EvidenceBadge, …)
│       └── viewer/             # CarViewer
└── assets/                     # fonts, GLB
```

Rules: a route imports from `src/features/*` and `src/shared/*`; a feature imports another only through
its `index.ts`; `shared` imports no feature.

## 6. Navigation

Four tabs (**my call**, changing the published TabBar; see §11):

| Tab | Contents |
|---|---|
| **Garage** | Vehicle cards, pending-claim rows, Add vehicle |
| **Scans** | Inbox of in-flight and reviewable invoices; Scan an invoice |
| **Passports** | All passports, newest first |
| **Account** | Email, appearance, sign out, model credit |

The earlier Timeline and Scan-as-action tabs are gone: a timeline belongs to one car, and platform
guidance says tabs are sections, not actions. Native bottom tabs on both platforms; system back
gestures stay intact.

```
app/
├── (auth)/sign-in, sign-up
├── (tabs)/index (garage), scans, passports, account
├── vehicles/new                         sheet
├── vehicles/[vin]/index                 stage + history
├── vehicles/[vin]/edit                  sheet
├── vehicles/[vin]/claims
├── vehicles/[vin]/events/new            sheet
├── vehicles/[vin]/events/[eventId]/index, edit (sheet)
├── vehicles/[vin]/passports/new         sheet
├── scans/new                            pick vehicle, then capture
├── scans/[jobId]                        review
└── passports/[id]
```

## 7. Screens

Every list has loading (skeleton), empty, error (with retry), and pull-to-refresh states.

**Sign-in / sign-up.** `bg` ground, `display-xl` headline, email and password. Errors in plain words.

**Garage.** Large title. One `VehicleCard` per car: make and model, year and fuel, VIN, and the latest
odometer **with the evidence badge of the entry it came from**, so the badge describes a real fact.
Odometer shows "No entries yet" with no timeline data. Pending-claim rows sit below the cars with
"Waiting for the current owner" and Withdraw. Primary action: Add vehicle. Empty state: the car stage
at rest, "Add your first car", Add vehicle.

**Add vehicle (sheet).** VIN (uppercased, `vin` style), make, model, engine (optional), year, fuel.
On 202, the sheet changes to explain that the owner will be asked, then closes.

**Vehicle detail** (the signature screen).
- Top ~40%: `CarViewer` stage, four colour chips, "Illustrative model" label.
- Name in `display`, VIN, facts (year, fuel, engine).
- Claims banner when `listPendingClaims` is non-empty.
- Actions: Add event, Scan an invoice, Create passport.
- History: `TimelineItem` list, newest first, grouped by year.
- Overflow: Edit vehicle, Give up ownership.

**Event detail.** Type, date, odometer, cost, notes, evidence badge, source. For scans: service name,
parts, labor. "View invoice" when `documentPresent`. Edit and Delete per the integration spec.

**Add / edit event (sheet).** Type (segmented), date (system picker, no future dates), odometer, cost,
currency (default RON), notes. For a DOCUMENTED event, everything but notes is shown read-only with a
line explaining why.

**Scans inbox.** Rows per job with status (integration spec §3.4.2), vehicle, and time submitted.
Primary action: Scan an invoice. Choosing a car comes first; skipped when there is only one.

**Capture.** Take photos or choose from the library, up to 20, with "One photo per invoice" stated on
screen. Thumbnails with remove. Prepares and validates before upload.

**Review.** The local invoice image is one tap away. `ScanField` rows for service name, date, odometer,
total, labor, and a parts list, all editable; plus type and currency. Warnings at the top in words.
Low-confidence fields flagged. Primary: "Confirm as documented". Secondary: Reject. In a batch, Next
moves to the following job.

**Passports.** `PassportCard` rows with status. **Passport detail:** card with QR (ACTIVE only), expiry
or "No expiry", truncated hash, created date. Actions: Share link, Save PDF, See what a buyer sees,
Revoke (`danger`).

**Create passport (sheet).** Explains the freeze, picks an expiry, creates, opens detail.

**Buyer web page** (`web/`, route `/public/passports/<token>`). Read-only, phone-first, in the same
tokens: vehicle facts, events with evidence badges, hash and algorithm, Download PDF. No owner data, and
no app-install prompt. The app's "See what a buyer sees" opens it in an in-app browser, so there is only
one buyer rendering to maintain (**my call**). Rules in integration spec §3.6.1.

**Claims.** Filing date only, Approve and Reject. Approve is a confirmation sheet stating the car moves
away.

**Account.** Email, appearance (System, Night garage, Daylight), sign out, version, 3D model credit.

## 8. Visual design

The design system artifact is authoritative for tokens, type, components, and voice. Summary: Night
garage (near-black tinted green) is the default theme and Daylight the second, following the system
setting; mint `brand` is the only interactive colour; racing green `brand-deep` for hero fields;
champagne appears only for `VERIFIED`. One authored motion moment per screen, the turntable; everything
else is quick ease-out, and Reduce Motion is honoured.

**Accessibility:** WCAG AA contrast; 44pt / 48dp targets; Dynamic Type and sp scaling without clipping;
screen-reader labels ("Evidence: documented"); status never by colour alone.

## 9. The 3D car

Reference: the `CarViewer` preview, a Ferrari 458 glTF in three.js with clearcoat paint, transmissive
glass, environment reflections, and a green-ringed turntable (**user** approved this look).

**Approach (my call): three.js inside a `react-native-webview`, not `expo-gl`.** This replaces what I said
earlier about `@react-three/fiber/native`. Three reasons:
1. The model is Draco-compressed, and `DRACOLoader` depends on Workers and WASM, which the React Native
   runtime doesn't provide.
2. The approved look relies on features (PMREM reflections, physical transmission) that are the least
   proven on `expo-gl`.
3. A WebView runs the same code as the preview that was approved.

Requirements:
- The HTML, three.js, decoder, and GLB ship **inside the app**. No CDN at runtime.
- Native ↔ WebView messages: `setColor`, `ready`, `error`.
- Dragging rotates the car without scrolling the page; vertical drags still scroll.
- Rendering pauses when the screen is unfocused or backgrounded.
- Stage is a static placeholder until `ready`, and on any load error. The rest of the screen never waits
  for 3D.
- At most one live WebGL stage at a time. Garage cards use a static image, not a live viewer.
- `prefers-reduced-motion` stops the auto-spin.

**First task of the plan is a time-boxed spike on real hardware**, on one recent iPhone and one mid-range
Android: pass if the stage holds 30 fps or better and matches the preview. It can run in Expo Go on the
product owner's own phones, so it needs no Apple account. On failure, drop transmission and lower the
pixel ratio. If it still fails, the app ships the static stage and work continues, and the 3D approach
comes back to the product owner as its own decision (**my call**).

The GLB must be bundled at a size that doesn't hurt install or first paint; the builder records it.

## 10. Testing (SDD)

1. Write `.feature` files first, from integration spec §5 and per screen.
2. Step definitions drive screens through React Native Testing Library against a fake API derived from
   the contract. No live server is needed.
3. Unit tests for parsers (`snapshot`, scan fields), odometer display, and the local stores.
4. A contract check: regenerate types and fail on a diff.
5. Manual device pass per platform, both themes, large text.

Delivery order: scaffold and design tokens → 3D spike → auth → garage and claims → timeline and events →
scans → passports → buyer web page → hardening.

## 11. Required corrections to the published design system

I built these components before reading the contract closely. They show things the API can't supply, or
contradict it. To apply after approval:

| Component | Problem | Fix |
|---|---|---|
| PassportCard | Says "Verified snapshot" with the champagne seal. Nothing has been verified; the hash is only a checksum. This contradicts the system's own rule. | "Frozen snapshot", no champagne |
| PassportCard | "14 entries" and a car name aren't in `PassportResponse` | Drop the count; name from the garage, else VIN |
| VehicleCard | "Sedan" and a vehicle-level evidence badge aren't in the API | Year and fuel; badge on the odometer only |
| TimelineItem | "Around 2022", "Date unknown": date, km and cost are required | Realistic data |
| TimelineItem guide | "Swipe only on events the owner created": the app can't know | Per integration spec |
| ScanField | "Invoice no." is not extracted | Real fields; add the warning state |
| ScanField guide | "Disable confirm until low-confidence rows are seen": the API says low confidence never blocks | Flag, don't block |
| TabBar | Timeline and Scan tabs | Garage, Scans, Passports, Account |
| CarViewer guide | Recommends `@react-three/fiber/native`; says Draco GLBs work with no code change | §9 |

## 12. Required before any public store release

Out of scope now, and blocking later:

1. **Replace the Ferrari.** CC BY 4.0 covers the model author's copyright, not Ferrari's trademarks, and
   the badges are visible. It needs a generic or licensed model. Today every car, say a Dacia, is shown as
   a Ferrari.
2. **In-app account deletion.** Apple and Google require it for apps with sign-up; the API has no such
   operation (integration spec G9).
3. **Password reset,** with its deep links, redirect URLs, and email setup.
4. **Production configuration and store paperwork:** hosted Supabase and API, privacy declarations, store
   assets.

## 13. Left to the builder

Exact library versions; query cache timing; skeleton design; animation details within §8; how the
WebView bundle is built; the fake API's internals; EAS build configuration.
