# Mobile ↔ API integration spec — vehicle-passport (v1)

Date: 2026-11-09 · Scope: how `mobile/` and the buyer web page consume the 26 operations that exist today · Status: draft for approval
Companion: `2026-11-09-mobile-app-design.md` (screens, navigation, visual design)

## 1. Intent

`contracts/openapi.yaml` says what each operation accepts and returns. This document says what the
**app does with it**: which screen calls it, when, what the user sees for each outcome, and where the
contract is not enough on its own. Behaviour marked *(server)* was verified in `server/` code or its
`.feature` files, because the contract does not state it.

**The backend does not change for this work.** Where the API lacks something, §6 records the gap and
the client-side workaround.

## 2. Cross-cutting rules

### 2.1 Client generation
TypeScript types are generated from `contracts/openapi.yaml` with `openapi-typescript`; requests go
through `openapi-fetch`. Generated output is never edited. A CI check fails if it is stale.

### 2.2 Base URL and auth
- Base URL: `EXPO_PUBLIC_API_URL`. A physical device cannot reach `localhost`; in development this is
  the machine's LAN address.
- Sign-in is Supabase Auth via `@supabase/supabase-js`. The contract has no auth endpoints.
- Every call except `/public/**` sends `Authorization: Bearer <access token>`. The JWT `sub` is the
  owner id; the app never sends it.
- Session storage must be encrypted. Supabase sessions exceed the `expo-secure-store` value limit, so
  use the Supabase-documented pattern: AES-encrypted value in AsyncStorage, key in SecureStore.

### 2.3 Error handling

| Response | Client behaviour |
|---|---|
| **401, empty body** (not problem+json) | Refresh the session once and retry the request once. Still 401: sign out, return to sign-in. Never parse the body. |
| **problem+json** | Branch on `code`, never on `detail` or `title`. Copy comes from the table in §4; `detail` is not shown to users. |
| Unknown `code` | Generic "Something went wrong. Try again." and log the code. |
| **404 `vehicle-not-found`** on a VIN that was in the garage | The car has left this account (transfer or release). Drop it from cache, return to Garage, say "This car is no longer in your garage." |
| Network failure | Non-blocking offline banner; reads show cached data; writes are not queued in v1. |

### 2.4 Binary responses
PDF, QR and invoice endpoints need the bearer header, so they cannot be handed to a plain URL viewer.
- QR: render with `expo-image`, passing `headers`.
- PDF and invoice: download with `expo-file-system` (with headers) to the cache directory, then open
  the system share/preview sheet. There is no in-app PDF renderer in v1.

### 2.5 Server state
TanStack Query owns server state. Query keys: `['vehicles']`, `['vehicle', vin]`, `['timeline', vin]`,
`['claims', vin]`, `['scan', jobId]`, `['passports']`. Mutations invalidate the keys listed in §3.
Refetch on screen focus.

## 3. Operations

### 3.1 Vehicles

| Operation | Called from | Client behaviour | Invalidates |
|---|---|---|---|
| `registerVehicle` `POST /vehicles` | Add vehicle | **201**: open the new vehicle. If the VIN has earlier history, it appears immediately *(server)*. **202**: no vehicle was created; save `{claimId, vin, filedAt}` in the local claim store (§6 G2) and show "Waiting for the current owner". | `vehicles` |
| `listMyVehicles` `GET /vehicles` | Garage | Empty list shows the empty state. Also resolves local claims: a claimed VIN now present means approved. | — |
| `getVehicle` `GET /vehicles/{vin}` | Vehicle detail | Seed from the list cache, then refresh. | — |
| `updateVehicle` `PATCH /vehicles/{vin}` | Edit vehicle | Send **only changed fields**; at least one is required, so Save stays disabled until something changes. VIN is read-only. | `vehicle`, `vehicles` |
| `releaseVehicle` `POST /vehicles/{vin}/release` | Vehicle detail, overflow | Confirmation sheet first. Warn: access to the history ends, unconfirmed scans are cancelled, and passports stay live until revoked *(server)*. Then return to Garage. | `vehicles`, `passports` |

Client validation for VIN: uppercase the input, reject anything failing `^[A-HJ-NPR-Z0-9]{17}$`, do not
check the check digit. `year`: 1886 to current year + 1.

### 3.2 Ownership claims

| Operation | Called from | Client behaviour | Invalidates |
|---|---|---|---|
| `listPendingClaims` `GET /vehicles/{vin}/claims` | Vehicle detail (banner), Claims screen | Fetch on focus. Only `claimId` and `filedAt` exist; the claimant is anonymous by design. | — |
| `approveClaim` | Claims screen | Confirmation sheet: the car and its editing rights move to someone else, other claims are rejected. On 204 the car leaves this garage; go to Garage. | `vehicles`, `claims`, `passports` |
| `rejectClaim` | Claims screen | Confirmation sheet; a rejection cannot be undone. | `claims` |
| `withdrawClaim` `POST /ownership-claims/{claimId}/withdraw` | Garage (pending claim row) | On 204 or 409 `claim-not-pending`, remove the local row. On 409 say "That claim was already decided." | — |

### 3.3 Events and timeline

| Operation | Called from | Client behaviour | Invalidates |
|---|---|---|---|
| `getTimeline` `GET /vehicles/{vin}/timeline` | Vehicle detail, Garage card | Returns **oldest first** and has no sort option *(server)*. The app needs newest first and the latest odometer, so it loads every page (`limit=100`, follow `nextCursor` until null) and reverses. Empty state when no items. | — |
| `addEvent` `POST …/events` | Add event | Requires `type, date, odometerKm, costAmount, currency`; currency defaults to RON. Result is always `USER_CONFIRMED` / `MANUAL`. | `timeline` |
| `updateEvent` `PUT …/events/{eventId}` | Edit event | Full replacement: always send every field. **DOCUMENTED events accept only a notes change** *(server)*: lock other fields and resend their original values unchanged. | `timeline` |
| `deleteEvent` `DELETE …/events/{eventId}` | Event detail | Confirmation sheet. Soft delete; existing passports keep the event *(server)*, and the sheet says so. | `timeline` |
| `getEventDocument` `GET …/document` | Event detail, only when `documentPresent` | Download per §2.4. On 403 `document-restricted`, show "This invoice stays private to the previous owner." | — |

The API does not say which events the caller may edit (§6 G4), so Edit and Delete are offered on every
event and a 403 `event-from-prior-owner` is handled when it happens. Once a 403 is seen, the actions are
hidden for that event for the rest of the session.

Event title on the timeline: `details.serviceName` if present, otherwise the label for `type`
(Service, Repair, Tires, ITP). Meta line: `odometerKm`, then `costAmount currency`.

### 3.4 Scans

| Operation | Called from | Client behaviour | Invalidates |
|---|---|---|---|
| `submitScan` `POST …/scans` | Scan flow, one file | Multipart field `file`. Prepare the file per §3.4.1. Save the returned job locally (§6 G1). | — |
| `submitScanBatch` `POST …/scan-batches` | Scan flow, 2–20 photos | Multipart field `files`. **One bad file rejects the whole batch** *(server)*, so every photo is prepared and checked first and the offending one is named. | — |
| `getScan` `GET /scans/{jobId}` | Scans inbox, Review | Poll while `PENDING` or `PROCESSING` and the screen is focused: every 2 s, backing off to 10 s; stop at any other status. | — |
| `confirmScan` `POST /scans/{jobId}/confirm` | Review | The one action that creates a DOCUMENTED event. Requires `date, odometerKm, total`. `type` defaults to SERVICE; `currency` defaults to RON and is not extracted, so the form always shows both. Guard against double submit. | `timeline`, `scan` |
| `rejectScan` `POST /scans/{jobId}/reject` | Review | Confirmation sheet; on 204 remove from inbox. | `scan` |

#### 3.4.1 File preparation (client, before upload)
- **Photos only** (decided by the product owner). The API accepts PDFs, but the planned OCR always ends
  them `FAILED` (PaddleOCR plan, decision P7), so the app doesn't offer them.
- **One photo per invoice.** One file becomes one job and one history entry, so the capture screen says
  so. Multi-page invoices are out of v1.
- **HEIC photos would be refused with 415**, so every image passes through `expo-image-manipulator` to
  JPEG, with the long edge at most 4096 px, which keeps it inside the OCR service's pixel limit.
- Reduce quality until under 10 MB.
- Send the correct part `Content-Type`; the server also checks the bytes *(server)*.

#### 3.4.2 Job status → inbox

| `status` | Inbox row | Action |
|---|---|---|
| `PENDING`, `PROCESSING` | "Reading invoice…" | none |
| `EXTRACTED` | "Ready to review" | open Review |
| `CONFIRMED` | removed; toast "Added to history" | — |
| `REJECTED` | removed | — |
| `FAILED` | "We couldn't read this invoice" | Retry (new job from the kept local file) or Enter by hand |
| `CANCELLED` | "Cancelled: this car left your garage" | Dismiss |

#### 3.4.3 Reading extracted fields
`fields` is null until extraction finishes. Each of `serviceName, date, odometerKm, parts, labor, total`
may be missing or null, or hold a null `value`; treat all three alike as an empty input. `value` is
untyped in the contract: `date` is an ISO date string, `odometerKm` and money are numbers, and `parts`
is `[{name, qty, price}]`. Parse defensively.

- Confidence below **0.8** flags the field ("Check"). It never blocks confirmation; the API says so.
- `TOTAL_MISMATCH`: shown, does not block.
- `ODOMETER_INCONSISTENT` and `DATE_IN_FUTURE`: shown on the field. They are warnings on the job but
  **hard errors at confirm** *(server)*, so the user is told to correct them first.
- 422 at confirm leaves the job `EXTRACTED`; keep the form and highlight the field.

### 3.5 Passports

| Operation | Called from | Client behaviour | Invalidates |
|---|---|---|---|
| `createPassport` `POST …/passports` | Vehicle detail | Optional `expiresAt`: picker offers 7 days, 30 days, 90 days, No expiry. Explain before creating that the snapshot is frozen and later events won't appear. | `passports` |
| `listMyPassports` `GET /passports` | Passports tab, Passport detail | Newest first *(server)*. There is no get-by-id; detail reads from this list. Includes passports for cars the user no longer owns *(server)*: those stay visible and revocable. Header is make/model when the VIN is in the garage, otherwise the VIN. | — |
| `revokePassport` `POST /passports/{id}/revoke` | Passport detail | Confirmation sheet. Idempotent. Cannot be undone; re-sharing needs a new passport. | `passports` |
| `getPassportPdf` `GET /passports/{id}/pdf` | Passport detail | §2.4. | — |
| `getPassportQr` `GET /passports/{id}/qr` | Passport detail | §2.4. Shown only when `ACTIVE`. | — |

`status` (`ACTIVE`, `REVOKED`, `EXPIRED`) is authoritative; never compute expiry on the device. Sharing sends `publicUrl` through the system share sheet.

### 3.6 Public

| Operation | Called from | Client behaviour |
|---|---|---|
| `getPublicPassport` `GET /public/passports/{token}` | Buyer web page, server side | No auth header. `snapshot` is untyped in the contract: read `vehicle` and `events` as described there; money is **strings with two decimals**, and `serviceName`, `parts`, `labor` are flat on the event. 404 means unknown, revoked or expired, deliberately indistinguishable: "This passport is no longer available." |
| `getPublicPassportPdf` | Buyer web page | The page's server streams the PDF through; no auth header. |

The app itself doesn't call these two. "See what a buyer sees" opens `publicUrl` in an in-app browser.

#### 3.6.1 Buyer web page
`publicUrl` is built as `PASSPORT_PUBLIC_BASE_URL + /public/passports/<token>` *(server)*. Pointing that
setting at a small site that serves the same path gives the QR and the PDF a real page, with no API change.

- **Fetch on the server, not in the browser.** The API has no CORS configuration, and a browser on
  another domain would be blocked.
- The token is a bearer capability: send `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, and
  `X-Robots-Tag: noindex`, and don't log it.
- Notes, service names and part names can come from OCR. Treat them as untrusted and HTML-escape them.
- The setting is read when a passport is created, and the PDF is generated then, so passports made
  before the change keep the old link in their PDF *(server)*.

## 4. Error copy

| `code` | Where | Message |
|---|---|---|
| `validation-failed` | any form | Inline per field where possible; otherwise "Check the highlighted details." |
| `invalid-vin` | Add vehicle | "That doesn't look like a valid VIN. It has 17 characters, without I, O or Q." |
| `invalid-vehicle` | Add / Edit vehicle | "Check the make, model and year." |
| `already-owner` | Add vehicle | "This car is already in your garage." Link to it. |
| `ownership-conflict` | Add vehicle, Approve | "Ownership changed in the meantime. Pull to refresh and try again." |
| `vehicle-not-found` | any | §2.3 |
| `claim-not-found`, `claim-not-pending` | Claims | "That claim was already decided." Refresh. |
| `event-not-found` | Event | "That entry no longer exists." Refresh timeline. |
| `event-from-prior-owner` | Edit / Delete | "This entry was added by a previous owner, so it can't be changed." |
| `document-restricted` | Invoice | "This invoice stays private to the previous owner." |
| `odometer-inconsistent` | Event, Confirm | "This mileage doesn't fit the car's history. Check the date and kilometres." |
| `invalid-event` | Event, Confirm | "Check the date, kilometres and cost." |
| `documented-event-immutable` | Edit | Should not occur (fields locked). "Only the notes of a scanned entry can be changed." |
| `invalid-cursor` | Timeline | Silently restart from the first page. |
| `scan-not-found` | Scans | Remove the local row. |
| `scan-state-conflict` | Review | Refetch and show the current status. |
| `file-too-large` | Scan | Should not occur (photos are resized). "That photo is too large." |
| `unsupported-file` | Scan | "That photo couldn't be used. Try taking it again." |
| `batch-too-large` | Scan | Prevented by the 20-file limit in the picker. |
| `expiry-in-past` | Create passport | "Choose a date in the future." |
| `passport-not-found` | Passports, Buyer view | Passports: refresh the list. Buyer view: §3.6. |

## 5. Behaviour specification (Gherkin)

These live in `mobile/features/` and run against a fake API built from the contract (see the app design, §10).

```gherkin
Feature: Session
  Scenario: An expired token is refreshed once
    Given my access token has expired
    When a request answers 401 with an empty body
    Then the session is refreshed and the request is retried once

  Scenario: A refused refresh signs me out
    Given the retried request also answers 401
    Then I am returned to sign-in

Feature: Garage
  Scenario: A VIN with an active owner files a claim
    When I register a VIN and the API answers 202
    Then no vehicle is added to my garage
    And I see a pending claim row for that VIN

  Scenario: An approved claim resolves itself
    Given I have a pending claim row for a VIN
    When my garage list contains that VIN
    Then the claim row is gone and the vehicle is shown

  Scenario: A car that left the account
    Given a vehicle is open
    When the API answers 404 "vehicle-not-found"
    Then I return to the garage and am told the car is no longer there

Feature: Timeline
  Scenario: Newest first across pages
    Given the API returns events oldest first over 3 pages
    When I open the vehicle
    Then all events are shown newest first

  Scenario: Documented entries only allow notes
    Given a DOCUMENTED event
    When I edit it
    Then only notes can be changed
    And the request resends the original type, date, odometer, cost and currency

  Scenario: Prior-owner entry
    When an edit answers 403 "event-from-prior-owner"
    Then I am told a previous owner added it
    And edit and delete are hidden for that event

Feature: Scanner
  Scenario: A HEIC photo is converted
    When I pick a HEIC photo
    Then the upload is a JPEG under 10 MB

  Scenario: Large photos are reduced before upload
    When I pick a 12000 by 9000 pixel photo
    Then the upload's long edge is at most 4096 px

  Scenario: The batch limit is enforced on the device
    When I try to add a 21st photo
    Then it is not added and I am told the limit is 20

  Scenario: PDFs are not offered
    When I open capture
    Then I can only take or choose photos

  Scenario: Nothing is saved without confirmation
    Given a job is EXTRACTED
    Then no event exists until I press confirm

  Scenario: Low confidence does not block
    Given a field has confidence 0.5
    Then it is marked "Check"
    And I can still confirm

  Scenario: Contradictory mileage is correctable
    When confirm answers 422 "odometer-inconsistent"
    Then my edits are kept and the odometer field is highlighted

  Scenario: Scans survive an app restart
    Given a job is PROCESSING
    When I restart the app
    Then the job is still in my inbox and keeps updating

Feature: Passport
  Scenario: Expiry comes from the server
    Given a passport whose status is EXPIRED
    Then it is shown as expired, without a QR code

  Scenario: A passport for a sold car stays manageable
    Given my passport's VIN is no longer in my garage
    Then it is listed under its VIN and I can revoke it

Feature: Buyer web page
  Scenario: A buyer opens a live passport
    When the page loads a valid token
    Then I see the vehicle, its events with evidence, and the hash
    And no owner data appears

  Scenario: Unavailable public link
    When the API answers 404
    Then I see one message, with no reason given

  Scenario: Scanned text cannot inject markup
    Given an event's notes contain "<script>"
    Then it is displayed as plain text
```

## 6. Contract gaps

None of these is fixed in this work. Each has a workaround that ships in v1, and a cleaner API change
for later.

| # | Gap | Effect | v1 workaround | Later API change |
|---|---|---|---|---|
| G1 | No "list my scan jobs" | Inbox can't be rebuilt from the server | Job ids and local file paths kept on the device. **Lost on reinstall or a second phone**; jobs there are orphaned until the user rescans. | `GET /scans` |
| G2 | No "list my claims" or claim status | A claimant can't see a rejection | Local claim store; approval inferred from the garage; rejection only surfaces on withdraw (409). | `GET /ownership-claims` |
| G3 | Timeline is oldest-first only | Every page must load to show the latest entry | Load all pages (§3.3). Fine at realistic sizes; costs one request per 100 events per car. | `order` param, or `latestOdometerKm` on `VehicleResponse` |
| G4 | Events don't say whether the caller may edit them | Edit is offered and can fail | Handle 403 reactively (§3.3). | `editable: boolean` on `EventResponse` |
| G5 | Vehicle has no colour or body type | Viewer colour is not saved server-side | Colour is a per-device preference keyed by VIN. | `color` on the vehicle |
| G6 | No scan file endpoint before confirm | Review can't show the invoice from the server | Show the local copy. If it is gone, Review works without the preview. | `GET /scans/{jobId}/document` |
| G7 | `snapshot` and `ScanField.value` are untyped | Generated types don't cover them | Hand-written parsers with defensive checks. | Typed schemas |
| G8 | `publicUrl` is the JSON API route | A buyer scanning the QR would see raw JSON | Buyer web page (§3.6.1) | None needed |
| G9 | No account-deletion operation | Blocks a public store release, not internal testing | None in v1 | A deletion operation, or a Supabase-side flow |
