# Mobile app and buyer page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo owner app in `mobile/` and the read-only buyer page in `web/`, consuming the 26 existing operations with no backend change.

**Architecture:** Feature-first React Native app. Route files in `app/` are thin. `src/shared` holds the generated API client, auth, design system and viewer; `src/features/{auth,vehicle,event,scan,passport}` hold hooks, components and pure model code. Behaviour is written as Gherkin first and driven through the real router against an in-memory fake API that validates every request against `contracts/openapi.yaml`.

**Tech Stack:** Expo SDK 58 (React Native 0.88, React 19.3, TypeScript 6), expo-router, `openapi-fetch` 0.17, TanStack Query 5, `@supabase/supabase-js`, react-hook-form + zod, Jest 30, jest-cucumber 4.5, React Native Testing Library 14. Buyer page: Hono on Node 24, `@cucumber/cucumber`.

**Specs (read both):** `docs/superpowers/specs/2026-11-09-mobile-api-integration.md` ("integration") and `docs/superpowers/specs/2026-11-09-mobile-app-design.md` ("design"). Design system: https://claude.ai/artifact/4744YKEHgeUzJgtoCZ3J3Y

**Path shorthand:** `S/` = `mobile/src/` · `R/` = `mobile/app/` · `F/` = `mobile/features/` · `T/` = `mobile/test/`.

| Command | Runs | Use |
|---|---|---|
| `TEST <path>` | `npm --prefix mobile test -- <path>` | one test file |
| `CHECK` | `npm --prefix mobile run check` | types, lint, contract freshness, all tests |
| `WEB` | `npm --prefix web run check` | buyer page types and Gherkin |

**Verified on a throwaway SDK 58 project before writing this plan:** the Jest, jest-cucumber, expo-router test renderer and `openapi-fetch` stack passes against a replaced `globalThis.fetch`, and `renderRouter('./app')` works with native tabs. It logs a stack from `createSeededNavigationState` while passing. Not verified: anything on a physical device (Tasks 4 and 15 are the gates).

## Global Constraints

- The backend and `contracts/openapi.yaml` do not change. No edits under `server/` or `contracts/`.
- Work on branch `feat/mobile-v1`. Stage only the paths each task lists; `server/pom.xml`, `application.properties`, `docs/diagrams`, `infra/` and `docs/research` hold unrelated uncommitted work.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Generated files are never edited by hand.
- Route files only import from `@/features/*` and `@/shared/*` and contain no logic. A feature imports another only through its `index.ts`. `shared` imports no feature. Allowed feature edges: `vehicle → event`, `scan → vehicle`, `scan → event`, `passport → vehicle`.
- Branch on `code`, never on `detail` or `title`. `detail` is never shown to users.
- All user-visible strings live in `S/shared/i18n/en.ts`. Error copy is integration §4, verbatim.
- Nothing may say "verified" unless the API returned `VERIFIED`. Champagne (`evidence-verified`) appears only for `VERIFIED`. Passports say "Frozen snapshot".
- A scanned value becomes DOCUMENTED only through `confirmScan`.
- Never show owner or claimant identity. Never compute passport expiry on the device.
- Limits: VIN `^[A-HJ-NPR-Z0-9]{17}$`, uppercased, no check digit. Year 1886 to current year + 1. Upload ≤ 10 485 760 bytes, long edge ≤ 4096 px, JPEG only, ≤ 20 photos. Low confidence is `< 0.8` and never blocks. Timeline `limit=100`.
- Touch targets 44pt iOS / 48dp Android. Never `allowFontScaling={false}`. Status never by colour alone.
- Query keys exactly `['vehicles']`, `['vehicle', vin]`, `['timeline', vin]`, `['claims', vin]`, `['scan', jobId]`, `['passports']`.

## Plan Decisions (gaps or contradictions in the specs; reject any at review)

| # | Decision | Why |
|---|---|---|
| P1 | The generator runs as pinned `npx --yes openapi-typescript@7.13.0`, not as a dependency | It declares peer `typescript@^5`; SDK 58 ships TypeScript 6 and `npm install` fails with ERESOLVE |
| P2 | Upload parts are `File` objects from `expo-file-system`, never `{uri, name, type}` | SDK 58 replaces global `fetch` with `expo/fetch`, whose FormData conversion rejects `uri` parts |
| P3 | PDF and invoice bytes go through the API client (`parseAs: 'arrayBuffer'`) and are written with `File.write`. Integration §2.4 said to download with `expo-file-system` | `File.downloadFileAsync` throws on any non-2xx and loses the body, so 403 `document-restricted` would be undetectable. This also gives downloads the 401 refresh |
| P4 | The fake API replaces `globalThis.fetch` and validates JSON bodies with Ajv against the contract, instead of MSW | Design §13 leaves this open. `fetch` is the seam the probe proved, and validation catches unknown fields, which the server rejects |
| P5 | Claim and scan stores are keyed by user id; sign-out clears the query cache | Specs are silent on two accounts on one phone |
| P6 | The latest selectable event date is `min(local today, UTC today)` | The server's clock is UTC, so in Romania "today" is refused between midnight and 02:00/03:00 |
| P7 | A part whose `qty` is null must be filled in before Confirm | OCR plan P5 keeps the row with `qty = null`; `Part.qty` is required at confirm |
| P8 | Warnings with known codes use catalog copy; unknown codes show the server's `message` | The OCR plan adds four codes the integration spec does not list |
| P9 | Withdraw answering 404 `claim-not-found` also removes the local row | §3.2 lists only 204 and 409, but §4 treats the two codes alike |
| P10 | "Reads show cached data" means TanStack's in-memory cache. Nothing is persisted | Keeps vehicle data off disk; v1 has no offline writes |
| P11 | `invalid-cursor` restarts from page one at most once per load, then fails | §4 says restart silently; unbounded restart can loop |
| P12 | Three extra native-to-viewer messages: `pause`, `resume`, `setReduceMotion` | Design §9 requires pausing and Reduce Motion but lists only `setColor`, `ready`, `error`; Android WebViews do not reliably report the media query |
| P13 | The viewer ships as one self-contained HTML asset (three.js, Draco decoder and GLB inlined), loaded by file URI | Design §13 leaves this open; §9 forbids a runtime CDN |
| P14 | Buyer page: Hono on Node 24, run directly with type stripping (`node src/server.ts`), system fonts | Design §4 leaves the runtime open. No build step, and Hono's `html` template escapes interpolated values |
| P15 | Scaffold and tokens come before the 3D spike | Design §9 says "first task", §10's delivery order puts it second; the spike needs a project to run in |
| P16 | Added dependencies the specs imply but do not name: `react-native-svg`, `@react-native-community/netinfo`, `@react-native-community/datetimepicker`, `expo-crypto` (AES key, in place of a random-values polyfill), `aes-js` | Icons, offline banner, system date picker, encrypted session |
| P17 | Passport with no expiry sends no request body | Verified: `PassportResource.createWithoutBody` exists |
| P18 (accepted by owner) | One `StagePlaceholder` (`brand-deep` field with the `car` icon) is the design's "static placeholder", the Garage card's "static image" and the Garage empty state's "stage at rest" | Design §9 needs a static stage but names no asset. A rendered still of the car would be one more Ferrari image to replace before a store release (design §12) |
| P19 (accepted by owner) | Starting a scan with no cars explains that a car is needed and offers Add vehicle | Design §7 covers one car and several, not none |
| P20 (accepted by owner) | `eas.json` has two profiles: `development` (dev client, internal distribution) and `internal` (store distribution, Android track `internal`) | Design §3 sets the release target and §13 leaves the configuration open, but something has to create it |

## Review Focus

1. Two accounts on one phone: after sign-out, the next user must see none of the first user's cars, claims or scans (Task 7).
2. Several screens' requests all expire at once: exactly one token refresh, every request retried (Task 6).
3. A Romanian keyboard's decimal comma: `149,50` is 149.5, never rejected or truncated (Task 10).
4. Adding an entry dated "today" just after midnight in Romania must not get a 422 (Task 10).
5. Malformed OCR output, such as `odometerKm: "abc"` or a part with no quantity: the review form opens with an empty input, never crashes, and cannot send an invalid part (Task 12).

---

### Task 1: Branch, spec commit and design-system corrections

Controller task: it needs the Artifact tool and has no test cycle.

**Files:** `docs/superpowers/specs/2026-11-09-mobile-api-integration.md`, `docs/superpowers/specs/2026-11-09-mobile-app-design.md`, `docs/superpowers/plans/2026-11-09-mobile-app.md`, `PRODUCT.md`; artifact files under `project/components/`.

- [ ] **Step 1: Create the branch and commit the documents, so a worktree contains them**

```bash
git switch -c feat/mobile-v1
git add docs/superpowers/specs/2026-11-09-mobile-api-integration.md docs/superpowers/specs/2026-11-09-mobile-app-design.md docs/superpowers/plans/2026-11-09-mobile-app.md PRODUCT.md
git commit -m "docs: add mobile app specs and plan"
```

- [ ] **Step 2: Apply every row of design §11 to the artifact's `README.md` and `preview.html` for PassportCard, VehicleCard, TimelineItem, ScanField, TabBar and CarViewer, then republish those files to the same URL.**

- [ ] **Step 3: Verify.** Re-read the six components. Expected: no "Verified snapshot", "Sedan", "Around 2022", "Date unknown", "Invoice no.", "Swipe only on events", `@react-three/fiber/native`, and the TabBar shows Garage, Scans, Passports, Account.

---

### Task 2: Expo scaffold, tooling and generated client

**Files:**
- Create: `mobile/` from the template; `mobile/jest.config.js`, `mobile/eslint.config.js`, `mobile/env.example`, `mobile/scripts/check-contract.mjs`, `T/setup.ts`, `T/fakes/nativeModules.ts`, `T/shell.test.tsx`, `R/_layout.tsx`, `R/(tabs)/_layout.tsx`, `R/(tabs)/index.tsx`, `S/shared/api/generated/schema.d.ts`, `.github/workflows/mobile.yml`
- Delete: `mobile/.gitkeep`, template `App.tsx`, `index.ts`

**Interfaces:**
- Produces: npm scripts `test`, `gen:api`, `check:contract`, `lint`, `typecheck`, `check`; type `paths` from `@/shared/api/generated/schema`; alias `@/*` → `src/*`.

- [ ] **Step 1: Scaffold**

```bash
rm mobile/.gitkeep
npx create-expo-app@latest mobile --template blank-typescript@sdk-58 --no-install
cd mobile && npm install
npx expo install expo-router expo-linking expo-constants react-dom react-native-screens react-native-safe-area-context react-native-svg react-native-webview @react-native-async-storage/async-storage @react-native-community/netinfo @react-native-community/datetimepicker expo-secure-store expo-crypto expo-image expo-image-picker expo-image-manipulator expo-file-system expo-sharing expo-web-browser expo-font expo-asset @expo-google-fonts/sora @expo-google-fonts/figtree @expo-google-fonts/jetbrains-mono
npx expo install --dev jest-expo jest @types/jest
npm i openapi-fetch@0.17.0 @tanstack/react-query @supabase/supabase-js aes-js react-hook-form zod @hookform/resolvers
npm i -D @testing-library/react-native@14 test-renderer jest-cucumber@4.5.0 ajv@8 ajv-formats@3 yaml eslint eslint-config-expo three@0.160.0 esbuild @types/aes-js
```

Expected: every install exits 0. `react-dom` must be installed by `expo install`, or the radix peers of expo-router fail with ERESOLVE.

- [ ] **Step 2: Configure the project**

`package.json`: `"main": "expo-router/entry"`, and scripts:

```json
{
  "test": "jest",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "gen:api": "npx --yes openapi-typescript@7.13.0 ../contracts/openapi.yaml -o src/shared/api/generated/schema.d.ts",
  "check:contract": "node scripts/check-contract.mjs",
  "check": "npm run typecheck && npm run lint && npm run check:contract && npm test"
}
```

`app.json`: name "Vehicle Passport", scheme `vehiclepassport`, `userInterfaceStyle: "automatic"`, `ios.bundleIdentifier` and `android.package` `com.vehiclepassport.app`, plugins `expo-router`, `expo-secure-store`, `expo-font`, and `expo-image-picker` with camera and photo usage strings about photographing invoices.

`tsconfig.json`: `strict: true`, `paths: {"@/*": ["./src/*"]}`, `types: ["jest"]` (TypeScript 6 no longer includes them automatically; without it `expect` is undefined).

`jest.config.js`: preset `jest-expo`, `setupFiles: ['<rootDir>/test/fakes/nativeModules.ts']` and `setupFilesAfterEnv: ['<rootDir>/test/setup.ts']`, `testMatch: ['**/test/**/*.steps.tsx', '**/test/**/*.test.ts?(x)', '**/src/**/*.test.ts?(x)']`, `moduleNameMapper: {'^@/(.*)$': '<rootDir>/src/$1'}`.

`T/fakes/nativeModules.ts`: `jest.mock` for `@react-native-async-storage/async-storage` and `@react-native-community/netinfo` (their official jest mocks), `expo-secure-store` (in-memory), and stubs for `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-sharing`, `expo-web-browser`, `react-native-webview`, each exported so tests can configure it. The `expo-file-system` stub's `File` extends the global `Blob` and has `uri`, `name`, `type`, `size`, `exists`, `write`, `copy`, `delete`.

`eslint.config.js`: extend `eslint-config-expo/flat`, plus:
- in `src/shared/**`, `no-restricted-imports` bans `@/features/*`;
- in `src/features/**` and `app/**`, bans `@/features/*/*` (index only);
- in `app/**` and `src/features/**`, `no-restricted-syntax` with selector `JSXText[value=/\\S/]` (strings come from the catalog), and on `JSXAttribute[name.name='allowFontScaling'][value.expression.value=false]`.

`mobile/env.example` (the root `.gitignore` ignores `.env*`): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

`mobile/.gitignore` from the template must cover `node_modules/` and `.expo/`.

- [ ] **Step 3: Write the failing shell test in `T/shell.test.tsx`**

```tsx
import { renderRouter, screen } from 'expo-router/testing-library';

test('the app opens on the garage route', async () => {
  await renderRouter('./app', { initialUrl: '/' });
  expect(screen).toHavePathname('/');
});
```

- [ ] **Step 4: Run it.** `TEST test/shell.test.tsx`. Expected: FAIL, no `app/` routes.

- [ ] **Step 5: Add `R/_layout.tsx` (Stack), `R/(tabs)/_layout.tsx` (`NativeTabs` from `expo-router/native-tabs` with `index` only for now) and a placeholder `R/(tabs)/index.tsx` that renders `null`.**

- [ ] **Step 6: Generate types and write `mobile/scripts/check-contract.mjs`.** `npm --prefix mobile run gen:api`. The script generates to a temp file, compares with the committed file with `\r` stripped, and on a difference prints `Generated API types are stale. Run npm run gen:api.` and exits 1.

- [ ] **Step 7: Prove the stale check.** Append a line to `schema.d.ts`, run `npm --prefix mobile run check:contract`. Expected: exit 1 with that message. Run `gen:api` again; expected: exit 0.

- [ ] **Step 8: Add `.github/workflows/mobile.yml`.** On push and PR touching `mobile/**`, `web/**` or `contracts/**`: Node 24, then `npm ci && npm run check` in `mobile`. (Task 14 adds `web`.)

- [ ] **Step 9: Run `CHECK`.** Expected: PASS.

- [ ] **Step 10: Commit** `mobile/`, `.github/workflows/mobile.yml` with `chore(mobile): scaffold Expo app, tooling and generated API types`.

---

### Task 3: Tokens, theme, primitives and tab shell

**Files:**
- Create: `mobile/design/tokens.json` (artifact `project/tokens.json`, sha256 `5b14b9181fe73ab6fd0c7535ee8699b7c6a668469bd1b60081d160d4938546d0`, or newer if Task 1 changed it), `mobile/scripts/gen-tokens.mjs`, `S/shared/design/tokens.generated.ts`, `S/shared/design/theme.tsx`, `S/shared/design/primitives/{Text,Button,Screen,Card,Field,EvidenceBadge,ConfirmSheet,AsyncList,EmptyState,ErrorState,Skeleton,Toast,Icon}.tsx`, `S/shared/design/index.ts`, `S/shared/i18n/en.ts`, `R/(tabs)/{scans,passports,account}.tsx`, `S/shared/design/*.test.tsx`
- Modify: `R/_layout.tsx`, `R/(tabs)/_layout.tsx`

**Interfaces:**
- Produces: `useTheme(): { colors, scheme, preference, setPreference }` with preference `'system' | 'dark' | 'light'` persisted in AsyncStorage key `appearance`; `<Text variant="display-xl|display|title-lg|title|body-lg|body|label|caption|vin|vin-sm" color?>`; `<Button kind="primary|secondary|danger" title onPress disabled loading>`; `<EvidenceBadge evidence>`; `<ConfirmSheet visible title body confirmLabel danger onConfirm onCancel>`; `<AsyncList query data keyExtractor renderItem empty>` (skeleton, empty, error with retry, pull to refresh); `toast(message: string): void` with `<ToastHost/>`; `<Icon name>`; `en`.

- [ ] **Step 1: Write failing tests**

```ts
// gen-tokens output
expect(tokens.color.dark.focus).toBe(tokens.color.dark.brand);          // {brand} alias resolved
expect(tokens.color.light.bg).toBe('#f3f6f4');
expect(tokens.type['display-xl']).toMatchObject({ fontSize: 44, lineHeight: 48 });
expect(tokens.type.vin.letterSpacing).toBeCloseTo(0.9);                 // 0.06em × 15
expect(tokens.space['space-4']).toBe(16);
expect(tokens.radius['radius-pill']).toBe(999);
```

```tsx
// EvidenceBadge
it.each([['ESTIMATED','Estimated'],['USER_CONFIRMED','Confirmed'],['DOCUMENTED','Documented'],['VERIFIED','Verified']])(
  '%s reads as %s', async (level, word) => {
    await render(<EvidenceBadge evidence={level} />);
    expect(screen.getByText(word)).toBeTruthy();
    expect(screen.getByLabelText(`Evidence: ${word.toLowerCase()}`)).toBeTruthy();
});
// Button: minHeight ≥ 48; disabled does not call onPress; loading does not call onPress
// AsyncList: pending renders skeleton; empty list renders `empty`; error renders retry that calls query.refetch
```

- [ ] **Step 2: Run them.** `TEST src/shared/design`. Expected: FAIL.

- [ ] **Step 3: Implement.** `gen-tokens.mjs` flattens to light/dark colour maps, converts `px` to numbers and `em` to `em × fontSize`, keeps shadows as `boxShadow` strings. RN needs one family name per weight: map Sora 700/600, Figtree 400/500 and 650→600, JetBrains Mono 500 in `Text`. Load fonts in the root layout and hold the splash until loaded. `Icon` uses the paths from artifact `project/components/bundle.js`. Native tabs use `sf` and `md` icons. Tabs: `index` "Garage", `scans` "Scans", `passports` "Passports", `account` "Account".

- [ ] **Step 4: Run `CHECK`.** Expected: PASS.

- [ ] **Step 5: Commit** `mobile/design`, `mobile/scripts/gen-tokens.mjs`, `mobile/app`, `mobile/src/shared/design`, `mobile/src/shared/i18n`, `mobile/package.json` with `feat(mobile): add design tokens, theme, primitives and tabs`.

---

### Task 4: 3D car stage spike

Includes an **owner gate on real phones**. Time-box: one working day.

**Files:**
- Create: `mobile/viewer/main.js`, `mobile/viewer/index.template.html`, `mobile/scripts/build-viewer.mjs`, `mobile/assets/viewer/ferrari.glb`, `mobile/assets/viewer/viewer.html`, `S/shared/viewer/CarViewer.tsx`, `S/shared/viewer/StagePlaceholder.tsx`, `S/shared/viewer/config.ts`, `S/shared/viewer/index.ts`, `S/shared/viewer/CarViewer.test.tsx`, `R/dev/viewer.tsx`
- Modify: `mobile/metro.config.js` (add `html` to `assetExts`), `mobile/package.json` (script `build:viewer`)

**Interfaces:**
- Produces: `<CarViewer color: string, active: boolean />`; `<StagePlaceholder />` (P18); `VIEWER_COLOURS = [{name:'Obsidian',hex:'#0f1a15'},{name:'Silver',hex:'#d9dedb'},{name:'Racing green',hex:'#1c6b49'},{name:'Rosso',hex:'#a3171d'}]`; `CAR_VIEWER_ENABLED: boolean` in `config.ts`.

- [ ] **Step 1: Write failing tests with the WebView stub**

```tsx
test('shows the placeholder until ready, then hides it')
  // before: getByTestId('stage-placeholder'); after message {type:'ready'}: queryByTestId is null
test('keeps the placeholder on error')          // message {type:'error'}
test('sends setColor when the colour changes')  // postMessage called with {type:'setColor',hex:'#a3171d'}
test('sends pause when active becomes false, resume when true')
test('sends pause when the app goes to the background, resume when it returns')  // while active stays true
test('sends setReduceMotion true when the OS asks for reduced motion')
test('renders only the placeholder when CAR_VIEWER_ENABLED is false')  // WebView not mounted
```

- [ ] **Step 2: Run them.** `TEST src/shared/viewer`. Expected: FAIL.

- [ ] **Step 3: Build the viewer.** `viewer/main.js` ports the lighting, camera, materials, turntable and colours of artifact `project/components/CarViewer/preview.html`, loads the model with `GLTFLoader.parse`, and caps pixel ratio at 2. The canvas has `touch-action: pan-y` and rotates only on horizontal drags. Pause stops the animation loop. `build-viewer.mjs` bundles with esbuild and inlines three.js 0.160.0, the Draco decoder from `three/examples/jsm/libs/draco/gltf/` (resolved through a `LoadingManager` URL modifier to blob URLs) and the GLB as base64. Fetch the GLB once from `https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/ferrari.glb` and commit it. No network URL may remain in `viewer.html`.

- [ ] **Step 4: Implement `CarViewer`.** Load `viewer.html` through `expo-asset` and pass the local URI to the WebView. The render loop runs only while `active` is true and `AppState` is `active`, because screen focus does not change when the app is backgrounded. Before `ready`, on error and when disabled, show `StagePlaceholder`. Add `R/dev/viewer.tsx` with an FPS readout from `{type:'fps'}` messages.

- [ ] **Step 5: Verify no CDN.** `grep -c "cdn.jsdelivr\|unpkg" mobile/assets/viewer/viewer.html`. Expected: `0`. Record the size of `viewer.html` in the task report (design §9).

- [ ] **Step 6: Run `CHECK`.** Expected: PASS.

- [ ] **Step 7: Commit** the Files list with `feat(mobile): add bundled 3D car stage`.

- [ ] **Step 8: OWNER GATE.** Stop and ask the product owner to run `npx expo start` from `mobile/`, open `/dev/viewer` in Expo Go on a recent iPhone and a mid-range Android, and report FPS and look. Pass: ≥ 30 fps, matches the preview, horizontal drag rotates, vertical drag scrolls. On fail: remove glass transmission and cap pixel ratio at 1.5, retry once. Still failing: set `CAR_VIEWER_ENABLED = false`, continue the plan, and return the 3D approach to the owner as a separate decision.

---

### Task 5: Contract-derived fake API

**Files:**
- Create: `T/fake-api/index.ts`, `T/fake-api/contract.ts`, `T/fake-api/handlers.ts`, `T/fake-api/builders.ts`, `T/fake-api/fake.test.ts`
- Modify: `T/setup.ts`

**Interfaces:**
- Consumes: `contracts/openapi.yaml`, `paths`.
- Produces:

```ts
installFakeApi(): FakeApi   // sets globalThis.fetch; `test/setup.ts` asserts no contract violations in afterEach
interface FakeApi {
  state: { vehicles; events: Record<string, EventResponse[]>; claims: Record<string, PendingClaimResponse[]>;
           otherOwnerVins: Set<string>; scans: Record<string, ScanJobResponse>; passports: PassportResponse[] };
  failNext(operationId: string, status: number, code: string | null): void; // null = empty body
  expireToken(token: string): void;
  callsTo(operationId: string): RecordedCall[];  // { path, headers, body, parts: {field,name,type,size}[] }
  violations: string[];
}
aVehicle(o?), anEvent(o?), aPassport(o?), aScanJob(o?)   // builders valid against the contract
```

- [ ] **Step 1: Write failing tests in `T/fake-api/fake.test.ts`**

```ts
test('has a handler for all 24 authenticated operations')   // parsed from the yaml; excludes getPublicPassport, getPublicPassportPdf
test('an unknown JSON field answers 400 validation-failed and is recorded in violations')
test('no bearer answers 401 with an empty body')
test('an expired token answers 401 with an empty body')
test('registerVehicle answers 202 for a VIN in otherOwnerVins and creates no vehicle')
test('timeline returns oldest first and pages with nextCursor')
test('a multipart part over 10 485 760 bytes answers 413 file-too-large')
test('a multipart part of type image/heic answers 415 unsupported-file')
test('21 files answer 422 batch-too-large')
test('failNext answers once with that status and code as problem+json')
```

- [ ] **Step 2: Run them.** `TEST test/fake-api`. Expected: FAIL.

- [ ] **Step 3: Implement.** Route by matching the contract's path templates. Validate JSON bodies with `Ajv2020` (`strict: false`, `multipleOfPrecision: 6`) and `ajv-formats` against `#/components/schemas/*`. A fake-side body rejection pushes to `violations`; `setup.ts` fails any test with an unexpected violation. Read uploads with `await request.formData()`. Mirror the *(server)* behaviours in the integration spec. `fake.test.ts` clears `violations` after the test that provokes one.

- [ ] **Step 4: Run `CHECK`.** Expected: PASS.

- [ ] **Step 5: Commit** `mobile/test` with `test(mobile): add contract-validated fake API`.

---

### Task 6: API client, errors, downloads and query defaults

**Files:**
- Create in `S/shared/api/`: `client.ts`, `authedFetch.ts`, `apiError.ts`, `errorMessage.ts`, `queryClient.ts`, `queryKeys.ts`, `useRefetchOnFocus.ts`, `onlineStatus.ts`, `binary.ts`, `index.ts`, tests beside them. `S/shared/auth/authPort.ts`, `S/shared/design/primitives/OfflineBanner.tsx`, `T/fakes/auth.ts`
- Modify: `S/shared/i18n/en.ts`, `T/setup.ts`

**Interfaces:**
- Produces:

```ts
// authPort.ts
interface AuthPort { getAccessToken(): Promise<string | null>; refresh(): Promise<string | null>; signOutLocal(): Promise<void> }
setAuthPort(port: AuthPort): void     // client.ts delegates to the current port
// authedFetch.ts
createAuthedFetch(auth: AuthPort, baseFetch: typeof fetch): (request: Request) => Promise<Response>
// client.ts
export const api: Client<paths>          // baseUrl EXPO_PUBLIC_API_URL
// apiError.ts
class ApiError extends Error { status: number; code: string | null }
unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T   // throws ApiError
isApiError(e: unknown, ...codes: string[]): boolean
// errorMessage.ts
errorMessage(e: unknown): string         // §4 copy; unknown code → generic + console.warn(code); non-ApiError → en.errors.network
// queryClient.ts
createAppQueryClient(opts: { onVehicleGone(vin: string): void }): QueryClient
// a query or mutation with meta: { vin } that fails vehicle-not-found triggers onVehicleGone, once per VIN per 5 s
// queryKeys.ts
qk.vehicles, qk.vehicle(vin), qk.timeline(vin), qk.claims(vin), qk.scan(jobId), qk.passports
// useRefetchOnFocus.ts
useRefetchOnFocus(refetch: () => unknown): void
// binary.ts
saveAndShare(bytes: ArrayBuffer, contentType: string, baseName: string): Promise<void>   // cache dir, expo-sharing
authHeaders(): Promise<Record<string, string>>
```

- [ ] **Step 1: Write failing tests**

```ts
// authedFetch
test('adds the bearer token')
test('an empty 401 refreshes once and retries once with the new token')
test('the retried request keeps its JSON body')
test('a second 401 signs out and returns the 401')
test('a refused refresh signs out without retrying')
test('a 401 with a body is returned untouched and does not refresh')
test('three concurrent 401s cause one refresh and three retries')   // Review Focus 2
// errorMessage
expect(errorMessage(new ApiError(409,'already-owner'))).toBe('This car is already in your garage.');
expect(errorMessage(new ApiError(403,'document-restricted'))).toBe('This invoice stays private to the previous owner.');
expect(errorMessage(new ApiError(500,'brand-new-code'))).toBe('Something went wrong. Try again.');
expect(errorMessage(new TypeError('Network request failed'))).toBe(en.errors.network);
// one test iterates every code in integration §4 and asserts a non-generic entry exists, except vehicle-not-found and passport-not-found
// queryClient
test('vehicle-not-found on a query with meta.vin calls onVehicleGone')
test('three failing queries for one VIN call onVehicleGone once')
test('another code does not call onVehicleGone')
test('ApiError is not retried; network errors retry once')
// binary
test('saveAndShare writes the bytes with an extension matching the content type and opens the share sheet')
```

- [ ] **Step 2: Run them.** `TEST src/shared/api`. Expected: FAIL.

- [ ] **Step 3: Implement.** Clone the request before sending, because a consumed body cannot be retried. Share one in-flight refresh promise. An empty 401 is status 401 with empty text. `client.ts` passes `fetch: createAuthedFetch(currentPort, (r) => globalThis.fetch(r))`, where `currentPort` forwards to whatever `setAuthPort` installed. Register TanStack `focusManager` with `AppState` and `onlineManager` with NetInfo in `onlineStatus.ts`. `T/fakes/auth.ts` installs a fake through `setAuthPort` in `T/setup.ts` and exposes `signInAs(id, email)`, `refreshCalls`, `failRefresh()`. Copy not fixed by the spec: `en.errors.network` "You're offline. Try again when you're connected."; banner "You're offline. Showing saved data."

- [ ] **Step 4: Run `CHECK`.** Expected: PASS.

- [ ] **Step 5: Commit** `mobile/src/shared`, `mobile/test` with `feat(mobile): add API client, session retry, error mapping and query defaults`.

---

### Task 7: Sign-in, sign-up and session

**Files:**
- Create: `S/shared/auth/supabase.ts`, `S/shared/auth/largeSecureStore.ts`, `S/shared/auth/largeSecureStore.test.ts`, `S/shared/auth/session.ts`, `S/features/auth/{api/useAuth.ts,components/SignInScreen.tsx,components/SignUpScreen.tsx,index.ts}`, `R/(auth)/{_layout,sign-in,sign-up}.tsx`, `F/session.feature`, `T/harness.tsx`, `T/steps/session.steps.tsx`
- Modify: `R/_layout.tsx`, `T/fakes/auth.ts` (also `jest.mock('@/shared/auth/supabase')`, so `useSession` follows the fake)

**Interfaces:**
- Produces: `useSession(): { status: 'loading'|'signedIn'|'signedOut'; userId: string|null; email: string|null }`; `signIn(email, password)`, `signUp(email, password)`, `signOut()` (clears the query cache, runs cleanups, routes to sign-in); `onSessionEnd(cb: () => void): () => void`; test helper `openApp(url: string, opts?: { as?: {id,email} | null }): Promise<FakeApi>`.

- [ ] **Step 1: Write `F/session.feature`.** Copy `Feature: Session` from integration §5 verbatim, then add:

```gherkin
  Scenario: Signed-out users land on sign-in
    Given I am signed out
    When the app opens
    Then I see the sign-in screen

  Scenario: Wrong password is explained
    When I sign in with a wrong password
    Then I am told the email or password is wrong
    And I stay on sign-in

  Scenario: A second account on the same phone sees nothing from the first
    Given I am signed in as "a" with a car in my garage
    When I sign out and sign in as "b"
    Then the garage is empty
```

- [ ] **Step 2: Write `T/steps/session.steps.tsx` and unit tests for `largeSecureStore`.** Unit: round-trip a 5 KB value; the AsyncStorage value is not the plaintext; the key is in SecureStore; `removeItem` clears both.

- [ ] **Step 3: Run them.** `TEST test/steps/session`. Expected: FAIL.

- [ ] **Step 4: Implement.** `largeSecureStore`: AES-CTR with `aes-js`, a 32-byte key from `expo-crypto`. `supabase.ts`: `autoRefreshToken`, `persistSession`, `detectSessionInUrl: false`, with start/stop refresh on `AppState`. `supabase.ts` calls `setAuthPort` with a port built on `getSession` and `refreshSession`; the root layout imports it. Clear the query cache and run `onSessionEnd` callbacks on every transition to signed-out, including a session lost through `signOutLocal`. Root layout provides `QueryClientProvider`, theme, toast host, offline banner, and redirects by session status. Sign-up with no session returned shows `en.auth.confirmationRequired` (hosted Supabase must keep confirmation off, design §3).

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add Supabase sign-in and encrypted session`.

---

### Task 8: Garage, add vehicle and pending claims

**Files:**
- Create: `S/features/event/{api/useTimeline.ts,model/timeline.ts,model/timeline.test.ts,index.ts}`, `S/features/vehicle/api/{useVehicles.ts,useRegisterVehicle.ts,useWithdrawClaim.ts}`, `S/features/vehicle/model/{claimStore.ts,claimStore.test.ts,vehicleForm.ts,vehicleForm.test.ts}`, `S/features/vehicle/components/{GarageScreen,VehicleCard,PendingClaimRow,AddVehicleScreen}.tsx`, `S/features/vehicle/index.ts`, `R/vehicles/new.tsx`, `F/garage.feature`, `T/steps/garage.steps.tsx`
- Modify: `R/(tabs)/index.tsx`, `R/_layout.tsx` (sheet presentation)

**Interfaces:**
- Consumes: `StagePlaceholder` from `@/shared/viewer`.
- Produces:

```ts
// event
fetchFullTimeline(vin: string): Promise<EventResponse[]>         // newest first
useTimeline(vin: string): UseQueryResult<EventResponse[]>        // key qk.timeline, meta {vin}
latestOdometer(events: EventResponse[]): { km: number; evidence: Evidence } | null
// vehicle
useVehicles(), useVehicle(vin)
useRegisterVehicle(): mutation → { kind: 'created'; vehicle } | { kind: 'claimFiled'; claim: LocalClaim }
claimStore.list(userId), .upsert(userId, c), .remove(userId, claimId), .dropResolved(userId, garageVins): Promise<LocalClaim[]>
type LocalClaim = { claimId: string; vin: string; filedAt: string }
vehicleFormSchema(now: Date): ZodSchema
```

- [ ] **Step 1: Write `F/garage.feature`.** Copy `Feature: Garage` scenarios 1 and 2 from integration §5 verbatim, then add:

```gherkin
  Scenario: The odometer comes from the latest entry
    Given a car with entries at 100 km, confirmed and 200 km, documented
    When I open the garage
    Then its card shows "200 km" with evidence "documented"

  Scenario: A car with no history
    Given a car with no entries
    Then its card shows "No entries yet"

  Scenario: Empty garage
    Given I have no cars
    Then I see "Add your first car"

  Scenario: The garage never runs a live 3D stage
    Given I have two cars
    When I open the garage
    Then no WebView is mounted

  Scenario: Filing the same claim twice shows one row
    Given I have a pending claim row for a VIN
    When I register that VIN and the API answers 202 with the same claim id
    Then I see one pending claim row

  Scenario Outline: Withdrawing removes the row
    Given I have a pending claim row for a VIN
    When I withdraw it and the API answers <answer>
    Then the row is gone

    Examples:
      | answer                  |
      | 204                     |
      | 409 "claim-not-pending" |
      | 404 "claim-not-found"   |

  Scenario: Already mine
    When I register a VIN and the API answers 409 "already-owner"
    Then I am told "This car is already in your garage."

  Scenario: Offline garage
    Given my garage has loaded
    When the connection drops
    Then I see the offline banner and my car is still shown
```

- [ ] **Step 2: Write failing unit tests**

```ts
// vehicleForm
expect(parse({ vin: 'wvwzzz1jzxw000001', ...ok }).vin).toBe('WVWZZZ1JZXW000001');
rejects({ vin: 'WVWZZZ1JZXW00000I' }); rejects({ vin: 'WVWZZZ1JZXW00000' });
rejects({ year: 1885 }); accepts({ year: 1886 });
accepts({ year: now.getFullYear() + 1 }); rejects({ year: now.getFullYear() + 2 });
// timeline
test('follows nextCursor with limit=100 until null and reverses')
test('invalid-cursor restarts once, then throws')          // P11
expect(latestOdometer([])).toBeNull();
expect(latestOdometer([anEvent({ odometerKm: 200, evidence: 'DOCUMENTED' }), anEvent({ odometerKm: 100 })]))
  .toEqual({ km: 200, evidence: 'DOCUMENTED' });   // input is newest first
// claimStore
test('upsert is idempotent by claimId'); test('entries are isolated by user id');
test('dropResolved removes claims whose VIN is in the garage and returns the rest');
```

- [ ] **Step 3: Run them.** `TEST test/steps/garage`, `TEST src/features`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.1, §3.2 (withdraw row) and design §7 (Garage, Add vehicle). On 202 the sheet explains the owner will be asked, then closes. `submit` passes only contract fields; omit `engine` when empty.

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src/features`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add garage, vehicle registration and pending claims`.

---

### Task 9: Vehicle detail, editing, release and claim decisions

**Files:**
- Create: `S/features/vehicle/api/{useUpdateVehicle,useReleaseVehicle,useClaims}.ts`, `S/features/vehicle/model/{changedFields.ts,changedFields.test.ts,viewerColorStore.ts}`, `S/features/vehicle/components/{VehicleDetailScreen,EditVehicleScreen,ClaimsScreen,ClaimsBanner}.tsx`, `R/vehicles/[vin]/{index,edit,claims}.tsx`, `F/vehicle.feature`, `T/steps/vehicle.steps.tsx`
- Modify: `R/_layout.tsx` (`onVehicleGone`: remove the VIN's cached queries, invalidate `qk.vehicles`, go to `/`, toast `en.vehicle.gone`), `S/features/vehicle/index.ts`

**Interfaces:**
- Consumes: `useTimeline`, `CarViewer`, `VIEWER_COLOURS`, `ConfirmSheet`.
- Produces: `changedFields(original: VehicleResponse, form: VehicleForm): Partial<UpdateVehicleRequest>`; `viewerColorStore.get(vin)`, `.set(vin, hex)`.

- [ ] **Step 1: Write `F/vehicle.feature`.** Copy `Scenario: A car that left the account` from integration §5 verbatim, then add:

```gherkin
  Scenario: A newly registered car opens
    When I register a VIN and the API answers 201
    Then the new vehicle is open

  Scenario: A car I already own is one tap away
    When I register a VIN and the API answers 409 "already-owner"
    Then I can open that vehicle from the message

  Scenario: Saving sends only what changed
    Given I am editing a vehicle
    When I change the model and save
    Then the request contains only the model

  Scenario: Nothing to save
    Given I am editing a vehicle
    Then Save is disabled

  Scenario: Giving up ownership warns first
    When I choose Give up ownership
    Then I am warned that access ends, unconfirmed scans are cancelled and passports stay live
    And no request is sent until I confirm

  Scenario: Pending claims are announced
    Given a vehicle has a pending claim
    When I open it
    Then I see the claims banner

  Scenario: Approving moves the car away
    Given a vehicle has a pending claim
    When I approve it and confirm
    Then I return to the garage and the car is gone

  Scenario: A claim already decided
    When I reject a claim and the API answers 409 "claim-not-pending"
    Then I am told "That claim was already decided."
    And the claim list refreshes

  Scenario: The claimant stays anonymous
    Given a vehicle has a pending claim
    Then only its filing date is shown

  Scenario: The stage never blocks the screen
    Given the 3D stage has not loaded
    When I open a vehicle
    Then I see its name and history

  Scenario: Colour is remembered
    When I choose "Rosso" and reopen the vehicle
    Then "Rosso" is selected
```

- [ ] **Step 2: Write `changedFields` tests.** Unchanged form → `{}`. Changed year only → `{ year }`. Engine cleared → `{ engine: '' }`: the contract's `engine` is non-null on update, and `Vehicle` stores a blank engine as null (verified).

- [ ] **Step 3: Run them.** `TEST test/steps/vehicle`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.1, §3.2 and design §7 (Vehicle detail, Claims). `CarViewer` gets `active={useIsFocused()}` so at most one stage renders. Actions route to `events/new`, `/scans/new?vin=`, `passports/new`; history comes in Task 10.

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src/features/vehicle`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add vehicle detail, edit, release and claim decisions`.

---

### Task 10: History and manual events

**Files:**
- Create: `S/features/event/api/{useAddEvent,useUpdateEvent,useDeleteEvent,useEventDocument}.ts`, `S/features/event/model/{eventForm.ts,eventForm.test.ts,lockedEvents.ts,display.ts,display.test.ts}`, `S/features/event/components/{HistoryList,TimelineItem,EventDetailScreen,EventFormScreen}.tsx`, `R/vehicles/[vin]/events/new.tsx`, `R/vehicles/[vin]/events/[eventId]/{index,edit}.tsx`, `F/timeline.feature`, `T/steps/timeline.steps.tsx`
- Modify: `S/features/event/index.ts`, `S/features/vehicle/components/VehicleDetailScreen.tsx`

**Interfaces:**
- Consumes: `useTimeline`, `onSessionEnd`, `saveAndShare`.
- Produces:

```ts
parseMoney(text: string): number | null
maxEventDate(now: Date, offsetMinutes?: number): string      // yyyy-mm-dd
formatLocalDate(d: Date): string
toEventRequest(original: EventResponse | null, form: EventForm): EventRequest
eventTitle(e: EventResponse): string
eventMeta(e: EventResponse): string
groupByYear(events: EventResponse[]): { year: number; events: EventResponse[] }[]
lockedEvents.lock(id), useIsLocked(id)     // cleared by onSessionEnd
```

- [ ] **Step 1: Write `F/timeline.feature`.** Copy `Feature: Timeline` from integration §5 verbatim, then add:

```gherkin
  Scenario: A manual entry is saved as confirmed
    When I add an event with default currency
    Then the request has currency "RON"
    And the new entry shows evidence "confirmed"

  Scenario: A decimal comma is understood
    When I add an event costing "149,50"
    Then the request has costAmount 149.5

  Scenario: Deleting explains what stays
    When I choose Delete on an event
    Then I am told existing passports keep this entry

  Scenario: A private invoice
    Given an event with a document
    When I view the invoice and the API answers 403 "document-restricted"
    Then I am told "This invoice stays private to the previous owner."

  Scenario: An invoice can be opened
    Given an event with a document
    When I view the invoice
    Then the system share sheet opens with that file

  Scenario: No invoice, no button
    Given an event without a document
    Then "View invoice" is not offered

  Scenario: Mileage that does not fit
    When saving an event answers 422 "odometer-inconsistent"
    Then I am told "This mileage doesn't fit the car's history. Check the date and kilometres."
    And my input is kept
```

- [ ] **Step 2: Write failing unit tests**

```ts
expect(parseMoney('149,50')).toBe(149.5);    expect(parseMoney('149.50')).toBe(149.5);   // Review Focus 3
expect(parseMoney('0')).toBe(0);
for (const bad of ['', 'abc', '-1', '1.999', '1.234,50']) expect(parseMoney(bad)).toBeNull();

expect(maxEventDate(new Date('2026-06-15T22:30:00Z'), -180)).toBe('2026-06-15');  // Bucharest 01:30 on the 16th; Review Focus 4
expect(maxEventDate(new Date('2026-06-16T02:00:00Z'), 300)).toBe('2026-06-15');   // New York 21:00 on the 15th
expect(formatLocalDate(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');

// toEventRequest on a DOCUMENTED original: only notes differ, other fields equal the original; keys are exactly the six of EventRequest
expect(eventTitle(anEvent({ details: { serviceName: 'Oil change' } }))).toBe('Oil change');
expect(eventTitle(anEvent({ type: 'TIRES', details: null }))).toBe('Tires');
expect(eventMeta(anEvent({ odometerKm: 84200, costAmount: 350, currency: 'RON' }))).toBe('84,200 km · 350 RON');
```

- [ ] **Step 3: Run them.** `TEST test/steps/timeline`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.3 and design §7 (Event detail, Add/edit event). The date field uses the system picker with `maximumDate` from `maxEventDate`. The currency input uppercases as the user types, because the contract requires `^[A-Z]{3}$`. Edit and Delete are hidden when `useIsLocked(id)`. Fetch documents with `parseAs: 'arrayBuffer'` and read the type from `response.headers` (P3).

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src/features`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add vehicle history and manual events`.

---

### Task 11: Capture, upload and scans inbox

**Files:**
- Create: `S/features/scan/model/{preparePhoto.ts,preparePhoto.test.ts,scanJobStore.ts,scanJobStore.test.ts,polling.ts,polling.test.ts,inboxRow.ts,inboxRow.test.ts}`, `S/features/scan/api/{uploadScans.ts,useScanJobs.ts}`, `S/features/scan/components/{InboxScreen,InboxRow,PickVehicle,CaptureScreen}.tsx`, `S/features/scan/index.ts`, `R/scans/new.tsx`, `F/scanner.feature`, `T/steps/scanner.steps.tsx`
- Modify: `R/(tabs)/scans.tsx`

**Interfaces:**
- Consumes: `useVehicles` from `@/features/vehicle`.
- Produces:

```ts
MAX_UPLOAD_BYTES = 10_485_760; MAX_LONG_EDGE = 4096; MAX_PHOTOS = 20
preparePhoto(asset: { uri: string; width: number; height: number }): Promise<PreparedPhoto>
type PreparedPhoto = { uri: string; size: number }               // JPEG in the document directory
class PhotoUnusableError extends Error {}
type LocalScanJob = { jobId: string; vin: string; localUri: string; submittedAt: string; batchId: string | null }
scanJobStore.list(userId), .add(userId, jobs), .remove(userId, jobId), .replace(userId, oldId, job)   // remove deletes the local file
uploadScans(vin: string, photos: PreparedPhoto[]): Promise<LocalScanJob[]>   // 1 → submitScan, 2..20 → submitScanBatch
useScanJobs(): { rows: InboxRowModel[]; dismiss(id); retry(id) }
nextPollDelay(attempt: number): number
inboxRow(status: ScanStatus): { label: string; action: 'none'|'review'|'failed'|'dismiss'; remove: boolean }
```

- [ ] **Step 1: Write `F/scanner.feature`.** Copy `Feature: Scanner` scenarios "A HEIC photo is converted", "Large photos are reduced before upload", "The batch limit is enforced on the device", "PDFs are not offered" and "Scans survive an app restart" verbatim from integration §5, then add:

```gherkin
  Scenario: One photo is one job
    When I upload one photo
    Then a single scan is requested with part "file"

  Scenario: Several photos are one batch
    When I upload three photos
    Then one batch is requested with three "files" parts
    And my inbox has three rows, each with its own photo

  Scenario: A bad photo is named before anything is sent
    Given the second of three photos cannot be prepared
    When I upload them
    Then I am told which photo is the problem
    And no request is sent

  Scenario: A failed scan can be retried from the kept photo
    Given a job is FAILED
    When I choose Retry
    Then a new job replaces the old row

  Scenario: A cancelled scan explains itself
    Given a job is CANCELLED
    Then I see "Cancelled: this car left your garage"

  Scenario: An orphaned job is dropped
    When polling a job answers 404 "scan-not-found"
    Then its row is removed

  Scenario: No car to scan for
    Given I have no cars
    When I start a scan
    Then I am told to add a car first and offered Add vehicle

  Scenario: The one-photo rule is stated
    When I open capture
    Then I see "One photo per invoice"

  Scenario: One car skips the car picker
    Given I have one car
    When I start a scan
    Then I go straight to capture

  Scenario: Camera access refused
    Given camera permission is denied
    When I choose Take photo
    Then I am told how to allow it
```

- [ ] **Step 2: Write failing unit tests**

```ts
expect([0, 1, 2, 3, 4].map(nextPollDelay)).toEqual([2000, 4000, 8000, 10000, 10000]);

// preparePhoto
test('12000×9000 is resized to long edge 4096')
test('a portrait 9000×12000 is resized by height')
test('a 1000×800 photo is not upscaled')
test('quality steps 0.9, 0.8, 0.7, 0.6, 0.5, 0.4 until ≤ 10 485 760 bytes')
test('throws PhotoUnusableError when 0.4 is still too large')
test('output is always JPEG and lives in the document directory')

// scanJobStore
test('isolated by user id'); test('remove deletes the local file'); test('survives a new store instance');

// inboxRow: one assertion per row of integration §3.4.2
```

- [ ] **Step 3: Run them.** `TEST test/steps/scanner`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.4, §3.4.1, §3.4.2 and design §7. Use `ImageManipulator.manipulate(uri).resize(...).renderAsync()` then `saveAsync({ format: SaveFormat.JPEG, compress })` (`manipulateAsync` is deprecated). Build `FormData` with `new File(localUri)` from `expo-file-system` (P2) through `bodySerializer`. The server keeps file order (verified in `ScanService`), so zip `jobs[i]` to `photos[i]`. Polling: `useQueries` with `enabled: isFocused` and `refetchInterval` from `nextPollDelay` only while `PENDING` or `PROCESSING`. On a failed upload, delete the prepared files. Retry is offered only if the local file exists; otherwise only Enter by hand, which routes to `/vehicles/[vin]/events/new`.

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src/features/scan`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add invoice capture, upload and scans inbox`.

---

### Task 12: Scan review and confirmation

**Files:**
- Create: `S/features/scan/model/{parseFields.ts,parseFields.test.ts,confirmRequest.ts,confirmRequest.test.ts,warnings.ts}`, `S/features/scan/api/{useScan,useConfirmScan,useRejectScan}.ts`, `S/features/scan/components/{ReviewScreen,ScanFieldRow,PartsEditor,WarningList}.tsx`, `R/scans/[jobId].tsx`, `F/review.feature`, `T/steps/review.steps.tsx`
- Modify: `S/features/scan/index.ts`

**Interfaces:**
- Consumes: `parseMoney`, `maxEventDate` from `@/features/event`. This adds the edge `scan → event`.
- Produces:

```ts
type Field<T> = { value: T | null; flagged: boolean }
type ReviewDraft = { serviceName: Field<string>; date: Field<string>; odometerKm: Field<number>;
  total: Field<number>; labor: Field<number>; parts: { name: string; qty: number | null; price: number | null }[];
  partsFlagged: boolean; type: EventType; currency: string; notes: string | null }
parseFields(fields: ScanFields | null | undefined): ReviewDraft      // defaults type SERVICE, currency RON
toConfirmRequest(d: ReviewDraft): ConfirmScanRequest | { missing: string[] }
warningText(w: ScanWarning): string
```

- [ ] **Step 1: Write `F/review.feature`.** Copy `Feature: Scanner` scenarios "Nothing is saved without confirmation", "Low confidence does not block" and "Contradictory mileage is correctable" verbatim from integration §5, then add:

```gherkin
  Scenario: Type and currency are always shown
    Given a job is EXTRACTED
    Then I see the type "Service" and the currency "RON"

  Scenario: A total mismatch is shown and does not block
    Given a job warns TOTAL_MISMATCH
    Then I see the warning
    And I can still confirm

  Scenario: A part with no quantity must be completed
    Given a part with no quantity
    When I confirm
    Then the quantity is highlighted and no request is sent

  Scenario: Confirming twice sends once
    When I press confirm twice
    Then one confirmation is requested

  Scenario: The job changed underneath me
    When confirm answers 409 "scan-state-conflict"
    Then the current status is shown

  Scenario: Rejecting asks first
    When I choose Reject and confirm
    Then the job leaves my inbox

  Scenario: The next invoice in a batch
    Given two extracted jobs from one batch
    When I confirm the first
    Then the second opens

  Scenario: The local photo is gone
    Given the job's local photo no longer exists
    When I open Review
    Then the form works without the preview
```

- [ ] **Step 2: Write failing unit tests**

```ts
for (const f of [null, undefined, {}, { date: null }, { date: { value: null, confidence: 0.9 } }])
  expect(parseFields(f).date.value).toBeNull();

expect(parseFields({ odometerKm: { value: 'abc', confidence: 0.9 } }).odometerKm.value).toBeNull();  // Review Focus 5
expect(parseFields({ date: { value: 'not-a-date', confidence: 0.9 } }).date.value).toBeNull();
expect(parseFields({ total: { value: '12', confidence: 0.9 } }).total.value).toBeNull();
expect(parseFields({ parts: { value: 'x', confidence: 0.9 } }).parts).toEqual([]);
expect(parseFields({ parts: { value: [{ name: 'Oil', qty: null, price: 120 }], confidence: 0.9 } }).parts[0].qty).toBeNull();
expect(parseFields({ total: { value: 10, confidence: 0.79 } }).total.flagged).toBe(true);
expect(parseFields({ total: { value: 10, confidence: 0.8 } }).total.flagged).toBe(false);
expect(parseFields(null)).toMatchObject({ type: 'SERVICE', currency: 'RON' });

expect(toConfirmRequest(draftWithoutTotal)).toEqual({ missing: ['total'] });
expect(toConfirmRequest(draftWithNullQty)).toEqual({ missing: ['parts.0.qty'] });
expect(warningText({ code: 'SOMETHING_NEW', message: 'From the server' })).toBe('From the server');
```

- [ ] **Step 3: Run them.** `TEST test/steps/review`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.4.3 and design §7 (Review). Guard double submit with a ref as well as `isPending`. On 422, `odometer-inconsistent` highlights the odometer and `invalid-event` highlights date, odometer and total; `DATE_IN_FUTURE` reaches confirm as `invalid-event` (verified in `VehicleEvent`). Warnings `ODOMETER_INCONSISTENT` and `DATE_IN_FUTURE` show on their field. The primary button reads "Confirm as documented". Invalidate `qk.timeline(vin)` and `qk.scan(jobId)`, toast "Added to history".

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src/features/scan`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add scan review and confirmation`.

---

### Task 13: Passports

**Files:**
- Create: `S/features/passport/api/{usePassports,useCreatePassport,useRevokePassport,usePassportFiles}.ts`, `S/features/passport/model/{display.ts,display.test.ts}`, `S/features/passport/components/{PassportsScreen,PassportCard,PassportDetailScreen,CreatePassportScreen}.tsx`, `S/features/passport/index.ts`, `R/vehicles/[vin]/passports/new.tsx`, `R/passports/[id].tsx`, `F/passport.feature`, `T/steps/passport.steps.tsx`
- Modify: `R/(tabs)/passports.tsx`

**Interfaces:**
- Consumes: `useVehicles`, `saveAndShare`, `authHeaders`.
- Produces: `type ExpiryChoice = 7 | 30 | 90 | null`; `expiryFrom(choice: ExpiryChoice, now: Date): string | null`; `passportHeader(p: PassportResponse, vehicles: VehicleResponse[]): string`; `truncateHash(hex: string): string`.

- [ ] **Step 1: Write `F/passport.feature`.** Copy `Feature: Passport` from integration §5 verbatim, then add:

```gherkin
  Scenario: The freeze is explained before creating
    When I open Create passport
    Then I am told later events will not appear

  Scenario: No expiry sends no date
    When I create a passport with "No expiry"
    Then the request has no body

  Scenario: A live passport can be shared
    Given an ACTIVE passport
    Then I see its QR code, Share link, Save PDF and See what a buyer sees

  Scenario: Revoking asks first
    Given an ACTIVE passport
    When I choose Revoke and confirm
    Then it is shown as revoked, without a QR code

  Scenario: Passports are never called verified
    Given an ACTIVE passport
    Then I see "Frozen snapshot"
    And the word "verified" does not appear

  Scenario: The buyer view opens the public page
    When I choose See what a buyer sees
    Then the in-app browser opens the passport's publicUrl

  Scenario: Saving the PDF
    When I choose Save PDF
    Then the system share sheet opens with a PDF
```

- [ ] **Step 2: Write failing unit tests**

```ts
expect(expiryFrom(7, new Date('2026-11-09T10:00:00Z'))).toBe('2026-11-16T10:00:00.000Z');
expect(expiryFrom(null, new Date())).toBeNull();
expect(passportHeader(aPassport({ vin: V }), [aVehicle({ vin: V, make: 'Dacia', model: 'Logan' })])).toBe('Dacia Logan');
expect(passportHeader(aPassport({ vin: V }), [])).toBe(V);
expect(truncateHash('9f2c0000000000000000000000000000a41b')).toBe('9F2C…A41B');
```

- [ ] **Step 3: Run them.** `TEST test/steps/passport`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.5 and design §7. QR: `expo-image` with `source={{ uri, headers }}`, where `headers` come from `authHeaders()` in a query, and `cachePolicy: 'none'`; on load error show a retry. Share `publicUrl` with React Native's `Share`. Buyer view: `WebBrowser.openBrowserAsync(publicUrl)`. Use `status` only; no date comparison anywhere.

- [ ] **Step 5: Run `CHECK`.** Expected: PASS.

- [ ] **Step 6: Commit** `mobile/src/features/passport`, `mobile/app`, `mobile/features`, `mobile/test` with `feat(mobile): add passports`.

---

### Task 14: Buyer web page

**Files:**
- Create: `web/package.json`, `web/package-lock.json`, `web/tsconfig.json`, `web/cucumber.mjs`, `web/README.md`, `web/scripts/gen-tokens.ts`, `web/src/{app.ts,server.ts,render.ts,snapshot.ts,tokens.generated.ts}`, `web/features/buyer.feature`, `web/features/steps/buyer.steps.ts`
- Modify: `.github/workflows/mobile.yml`

**Interfaces:**
- Consumes: `mobile/design/tokens.json`; `GET /public/passports/{token}` and `/pdf` from the API.
- Produces: `createApp(deps: { apiBaseUrl: string; fetch: typeof fetch }): Hono`; `parseSnapshot(raw: unknown): Snapshot | null`; env `API_BASE_URL`, `PORT`.

- [ ] **Step 1: Set up.** `web/package.json`: `"type": "module"`, `"engines": {"node": ">=24"}`, scripts `start: node src/server.ts`, `check: tsc --noEmit && cucumber-js`. `npm i hono@4 @hono/node-server@2` and `npm i -D typescript @types/node @cucumber/cucumber@13`. `tsconfig.json`: `allowImportingTsExtensions`, `erasableSyntaxOnly`, `noEmit`, `strict`. `cucumber.mjs`: `export default { import: ['features/steps/*.ts'], paths: ['features/*.feature'] }`.

- [ ] **Step 2: Write `web/features/buyer.feature`.** Copy `Feature: Buyer web page` from integration §5 verbatim, then add:

```gherkin
  Scenario: Every response protects the token
    When the page loads any token
    Then the response has "Referrer-Policy: no-referrer"
    And "Cache-Control: no-store"
    And "X-Robots-Tag: noindex"

  Scenario: The PDF is streamed through
    When I open the PDF of a valid token
    Then I receive application/pdf from the API without an Authorization header

  Scenario: Money is shown as the snapshot gives it
    Given an event costing "149.50"
    Then the page shows "149.50"

  Scenario: An event with no parts detail
    Given an event without "parts"
    Then the page still renders

  Scenario: Evidence is stated, never upgraded
    Given an event with evidence "DOCUMENTED"
    Then I see "Documented"
    And the word "Verified" does not appear

  Scenario: The API is down
    When the API cannot be reached
    Then I see a temporary-problem message and status 502

  Scenario: A snapshot that cannot be read
    Given the API returns a snapshot with no vehicle
    Then I see a temporary-problem message and status 502
```

- [ ] **Step 3: Write the step definitions** using `app.request(path)` with a stub `fetch`. Run `WEB`. Expected: FAIL.

- [ ] **Step 4: Implement** per integration §3.6, §3.6.1 and design §7 (Buyer web page). Fetch server-side only; `encodeURIComponent` the token; no request logging. Render with Hono's `html` template so interpolated values are escaped. 404 copy: "This passport is no longer available." `gen-tokens.ts` writes CSS custom properties for both themes under `prefers-color-scheme`. Label the hash as integrity only; no app-install prompt; no owner data.

- [ ] **Step 5: Add the `web` job to `.github/workflows/mobile.yml`.** `npm ci && npm run check` in `web`.

- [ ] **Step 6: Document in `web/README.md`:** set `PASSPORT_PUBLIC_BASE_URL` on the API to this site; passports created earlier keep the old link in their PDF.

- [ ] **Step 7: Run `WEB`.** Expected: PASS.

- [ ] **Step 8: Commit** `web/`, `.github/workflows/mobile.yml` with `feat(web): add buyer passport page`.

---

### Task 15: Account, hardening and device pass

Includes an **owner gate on real phones**.

**Files:**
- Create: `S/features/auth/components/AccountScreen.tsx`, `F/account.feature`, `T/steps/account.steps.tsx`, `T/operations-covered.test.ts`, `mobile/README.md`, `mobile/eas.json`
- Modify: `R/(tabs)/account.tsx`, `S/features/auth/index.ts`, `mobile/package.json`
- Delete: `R/dev/viewer.tsx`, once Task 4's gate has passed

- [ ] **Step 1: Write `F/account.feature`**

```gherkin
Feature: Account
  Scenario: Account details
    When I open Account
    Then I see my email, the app version and the 3D model credit

  Scenario: Appearance is remembered
    When I choose "Daylight" and restart the app
    Then "Daylight" is selected

  Scenario: Signing out
    When I choose Sign out
    Then I am returned to sign-in
```

- [ ] **Step 2: Write `T/operations-covered.test.ts`.** Parse the contract's 24 authenticated operations and assert each `(method, path)` appears as `api.<METHOD>('<path>'` somewhere under `src/features`. `getPassportQr` is the one exception, because Task 13 loads it through `expo-image`: for that operation assert that `usePassportFiles.ts` contains `/qr`.

- [ ] **Step 3: Run them.** `TEST test/steps/account`, `TEST test/operations-covered`. Expected: the account steps FAIL. The coverage test passes unless an earlier task missed an operation.

- [ ] **Step 4: Implement `AccountScreen`** per design §7. Credit: "Ferrari 458 model: vicent091036, CC BY 4.0".

- [ ] **Step 5: Add any operation the coverage test reports missing, and screen-reader labels on every icon-only control.**

- [ ] **Step 6: Write `mobile/README.md`:** env values, LAN address for `EXPO_PUBLIC_API_URL`, local Supabase (`infra/SUPABASE-LOCAL.md`), hosted Supabase must keep email confirmation off, and internal builds need an HTTPS API because release builds refuse cleartext.

- [ ] **Step 7: Add the build configuration (P20).** `npx expo install expo-dev-client` in `mobile/`, then write `mobile/eas.json`:

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "internal": { "distribution": "store", "autoIncrement": true }
  },
  "submit": {
    "internal": { "android": { "track": "internal" } }
  }
}
```

Add to `mobile/README.md`: the three `EXPO_PUBLIC_*` values are set as EAS environment variables, and iOS builds run in the EAS cloud because development is on Windows.

- [ ] **Step 8: Run `CHECK` and `WEB`.** Expected: PASS.

- [ ] **Step 9: Commit** `mobile/`, with `feat(mobile): add account screen, operation coverage check and build profiles`.

- [ ] **Step 10: OWNER GATE: device pass against the real API and OCR,** on one iPhone and one Android, both themes, largest text size.

| Check | Pass |
|---|---|
| Single photo upload | Job reaches `EXTRACTED`. The part's `Content-Type` is `image/jpeg`, not refused with 415 (`File.type` is native) |
| 20-photo batch on the mid-range Android | Completes without a crash. `expo/fetch` builds the whole multipart body in memory. On failure, ask the owner whether to send photos one at a time through `submitScan` |
| 401 refresh | Wait out a token expiry mid-session; the next action works |
| Save PDF and View invoice | Share sheet opens with a readable file |
| QR | Renders; scanning it opens the buyer page |
| Camera, Dynamic Type, screen reader, back gestures | Per design §8 |
| Vertical scroll over the 3D stage | Page scrolls on both platforms |
| Reduce Motion | No auto-spin |

Fix failures as follow-up commits with their own regression test where one is possible.

- [ ] **Step 11: OWNER GATE: internal release (design §3).** This needs a paid Apple Developer account, a Google Play developer account and an HTTPS API, so stop and ask the product owner to run, from `mobile/`: `npx eas-cli init`, `npx eas-cli build --profile internal --platform all`, then `npx eas-cli submit --profile internal --platform all`. Expected: the app installs from TestFlight and from the Play internal track, and signs in against the configured API.
