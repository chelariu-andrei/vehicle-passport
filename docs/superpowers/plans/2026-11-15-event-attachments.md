# Event Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any event carry 0..10 receipt/estimate files with server-side SHA-256 dedup, and make mobile Save pass through a "check it carefully" sheet.

**Architecture:** Attachments live inside the `event` feature (new table `event_attachment`, new use cases next to `EventService`). The scan feature's confirmed document becomes a `SCAN_SOURCE` attachment. Mobile stages files locally, uploads them after the event is created, and reuses `ConfirmSheet` (extended with a `children` slot) for verification.

**Tech Stack:** Quarkus + Panache + Flyway + S3 client + Cucumber (server); Expo, expo-router, react-hook-form, TanStack Query, openapi-fetch, jest/testing-library (mobile); `expo-document-picker` (new).

**Spec:** `docs/superpowers/specs/2026-11-15-event-attachments-design.md`

## Global Constraints

- Contract first: change `contracts/openapi.yaml` before code; regenerate with `npm run gen:api` in `mobile/`.
- Hexagonal rules from `.claude/ARCHITECTURE.md`: domain has no framework annotations; `shared` depends on no feature; `event` never imports `scan`.
- Files: JPEG, PNG, PDF only; ≤ 10 485 760 bytes; magic bytes checked; max 10 live attachments per event.
- Error codes (exact): `duplicate-document` (409), `attachment-limit` (422), `attachment-protected` (422); reuse `event-from-prior-owner` (403), `document-restricted` (403), `event-not-found`/`vehicle-not-found` (404).
- Evidence is never changed by attachments. Manual + files stays `USER_CONFIRMED`.
- Dedup key is `(vin, sha256)` among live `UPLOAD` rows; never visible across vehicles or users.
- Migrations: Flyway `V6__event_attachment.sql` (next free number); the `vehicle_event.document_key` column stays (read-only).
- Mobile copy lives in `mobile/src/shared/i18n/en.ts`; no hard-coded strings in components.
- Server tests per `server/AGENTS.md` (Quarkus MCP test tool); fallback `mvn -q verify` from `server/`.
- Commit after each task. Commit messages end with the Co-Authored-By line from the session.

## Review Focus

- Two identical uploads racing: the unique index decides, the loser gets `409 duplicate-document`, never a 500 (Task 4).
- Zero-byte file or right extension with wrong magic bytes: `415`, nothing stored (Task 2).
- Soft-deleting an event also frees its attachments' hashes, so the file can be attached to a new event (Task 4).
- Double tap on "Yes, these are correct": exactly one `POST /events` (Task 8).
- Event created but one file fails to upload: event kept, user told which files failed, retry possible (Task 10).
- A later owner sees "N documents" but cannot open or delete them (Tasks 4, 11).

---

## File Structure

Server (`server/src/main/java/com/vehiclepassport/server/`):
- `shared/util/UploadPolicy.java` — moved from `scan/domain/model/ScanFilePolicy.java`.
- `event/domain/model/Attachment.java`, `AttachmentKind.java` — pure model.
- `event/domain/exception/DuplicateDocumentException.java`, `AttachmentLimitException.java`, `AttachmentProtectedException.java`.
- `event/application/port/in/` — `AddAttachmentUseCase`, `ListAttachmentsUseCase`, `OpenAttachmentUseCase`, `DeleteAttachmentUseCase`, `AttachmentView`, `AttachmentUpload`.
- `event/application/port/out/AttachmentRepositoryPort.java`; extend `DocumentStoragePort` with `put`/`delete`.
- `event/application/service/AttachmentService.java`.
- `event/infrastructure/persistence/entity/EventAttachmentEntity.java`, `.../repository/AttachmentPanacheRepository.java`.
- `event/api/AttachmentResource.java`, `event/api/dto/AttachmentResponse.java`, `event/api/mapper/AttachmentDtoMapper.java`.
- `resources/db/migration/V6__event_attachment.sql`.

Mobile (`mobile/src/`):
- `shared/design/primitives/ConfirmSheet.tsx` — add `children`.
- `features/event/model/eventSummary.ts` — rows shown in the verification sheet.
- `features/event/model/stagedFiles.ts` — local staging list + limits.
- `features/event/api/useAttachments.ts`, `useUploadAttachments.ts`, `useDeleteAttachment.ts`, `useOpenAttachment.ts`.
- `features/event/components/DocumentsSection.tsx`, `AttachmentList.tsx`; edits to `EventFormScreen.tsx`, `EventDetailScreen.tsx`, `TimelineItem.tsx`.

---

### Task 1: Contract

**Files:**
- Modify: `contracts/openapi.yaml`, `mobile/src/shared/api/generated/schema.d.ts` (generated)

**Interfaces:**
- Produces: operations `addAttachment`, `listAttachments`, `getAttachment`, `deleteAttachment`; schema `AttachmentResponse { id: uuid, contentType: string, sizeBytes: integer, sha256: string, kind: 'SCAN_SOURCE'|'UPLOAD', createdAt: date-time }`; `EventResponse.attachmentCount: integer (min 0)` added to `required`.

- [ ] **Step 1:** Under `/vehicles/{vin}/events/{eventId}` add `/attachments` (POST multipart field `file`, GET list) and `/attachments/{attachmentId}` (GET binary `image/jpeg|image/png|application/pdf`, DELETE `204`), with the responses listed in the spec §6. Add parameter `AttachmentId`. Mark `getEventDocument` `deprecated: true`.
- [ ] **Step 2:** Add `AttachmentResponse`, add `attachmentCount` to `EventResponse` (required). Leave the passport snapshot schema untouched.
- [ ] **Step 3:** Run `npm run gen:api` in `mobile/`. Expected: `schema.d.ts` changes, command exits 0.
- [ ] **Step 4:** Commit `contracts/openapi.yaml` and `schema.d.ts`: `feat(contracts): event attachments`. Note: mobile `operations-covered.test.ts` and fake-API contract tests stay red until Task 9; do not "fix" them here.

### Task 2: Shared upload policy

**Files:**
- Move: `scan/domain/model/ScanFilePolicy.java` → `shared/util/UploadPolicy.java`; test `scan/domain/ScanFilePolicyTest.java` → `shared/util/UploadPolicyTest.java`
- Modify: `scan/application/service/ScanService.java` (use `UploadPolicy`)

**Interfaces:**
- Produces: `UploadPolicy.check(String contentType, long size, byte[] head)`, `UploadPolicy.MAX_BYTES`, `UploadPolicy.checkBatchSize(int)` (unchanged behaviour). Exceptions stay the scan ones until moved: move `UnsupportedFileException`, `FileTooLargeException`, `BatchTooLargeException` to `shared/error` keeping their codes and HTTP mapping.

- [ ] **Step 1:** Add tests to the moved `UploadPolicyTest`: `rejectsEmptyFile` (size 0, empty head → `UnsupportedFileException`) and `rejectsPdfDeclaredAsJpeg`.
- [ ] **Step 2:** Run the test; expect the two new tests FAIL (empty file currently falls through to the signature check; verify) or pass if already covered, then keep them.
- [ ] **Step 3:** Perform the move/rename and update imports; `shared` must not import `scan` (the architecture test in `src/test` enforces it).
- [ ] **Step 4:** Run the unit tests and the architecture test. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(server): move upload policy to shared`.

### Task 3: Persistence and domain model

**Files:**
- Create: `V6__event_attachment.sql`, `Attachment.java`, `AttachmentKind.java`, `AttachmentRepositoryPort.java`, `EventAttachmentEntity.java`, `AttachmentPanacheRepository.java`
- Test: `src/integration-test/java/com/vehiclepassport/server/event/AttachmentPersistenceIT.java`

**Interfaces:**
- Produces: `record Attachment(UUID id, UUID eventId, String vin, String sha256, String contentType, long sizeBytes, String storageKey, AttachmentKind kind, UUID createdBy, Instant createdAt, Instant deletedAt)`; `enum AttachmentKind { SCAN_SOURCE, UPLOAD }`.
- Produces: `AttachmentRepositoryPort { void save(Attachment); Optional<Attachment> findLive(UUID eventId, UUID id); List<Attachment> liveFor(UUID eventId); int countLive(UUID eventId); Optional<Attachment> findLiveUploadByHash(String vin, String sha256); void softDelete(UUID id, Instant at); void softDeleteAllFor(UUID eventId, Instant at); Map<UUID,Integer> countsFor(Collection<UUID> eventIds); }`. `save` of a second live `UPLOAD` with the same `(vin, sha256)` throws `DuplicateDocumentException(UUID existingEventId)` (translate the unique-violation).

- [ ] **Step 1:** Write `AttachmentPersistenceIT`: `savesAndListsLive`, `duplicateUploadHashOnSameVinThrows`, `sameHashOnOtherVinIsAllowed`, `softDeletedHashCanBeReused`, `scanSourceIsExemptFromUniqueness`, `migrationBackfillsDocumentKeyAsScanSource` (insert a `vehicle_event` with `document_key` before V6 is not possible, so assert via SQL that V6's backfill statement is idempotent on a seeded row: run the statement manually in the test).
- [ ] **Step 2:** Run it; expect FAIL (no table/classes).
- [ ] **Step 3:** Write `V6__event_attachment.sql` per spec §5 (columns, partial unique index `where kind = 'UPLOAD' and deleted_at is null`, index on `event_id`), plus the backfill `insert … select` from `vehicle_event where document_key is not null` with `sha256 = null`, `kind = 'SCAN_SOURCE'`, `content_type = 'application/octet-stream'` (legacy, unknown), `size_bytes = 0`. Add the entity, repository, domain record and port.
- [ ] **Step 4:** Run the IT. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): event attachment persistence`.

### Task 4: Attachment use cases

**Files:**
- Create: the `port/in` types, exceptions, `AttachmentService.java`
- Modify: `DocumentStoragePort.java` + `S3EventDocumentAdapter.java` (add `put`/`delete`), `EventService.java` (event delete cascades via `AttachmentRepositoryPort.softDeleteAllFor`)
- Test: `src/test/java/.../event/application/AttachmentServiceTest.java` (fakes, no Quarkus)

**Interfaces:**
- Consumes: `AttachmentRepositoryPort` (Task 3), `UploadPolicy` (Task 2), existing `ActiveOwnerPort`, `EventRepositoryPort`.
- Produces: `AddAttachmentUseCase.add(UUID userId, String vin, UUID eventId, AttachmentUpload file) → AttachmentView`; `ListAttachmentsUseCase.list(userId, vin, eventId) → List<AttachmentView>`; `OpenAttachmentUseCase.open(userId, vin, eventId, attachmentId) → EventDocument`; `DeleteAttachmentUseCase.delete(userId, vin, eventId, attachmentId)`; `AttachmentUpload(InputStream content, String contentType, long declaredSize)`; `AttachmentView(id, contentType, sizeBytes, sha256, kind, createdAt)`; `DocumentStoragePort.put(String key, Path file, String contentType)` and `delete(String key)`.

- [ ] **Step 1:** Write `AttachmentServiceTest` with: `addStoresHashOfRawBytes` (known SHA-256 of fixed bytes), `duplicateOnSameVinThrowsDuplicateDocument`, `sameBytesOnOtherVinStored`, `eleventhFileThrowsAttachmentLimit`, `priorPeriodEventRejectsAdd` (→ `PriorPeriodEventException`), `laterOwnerCannotOpen` (→ `DocumentRestrictedException`), `deleteScanSourceThrowsProtected`, `deleteUploadFreesHash`, `addToDocumentedEventAllowedAndKeepsEvidence`, `evidenceOfManualEventUnchangedAfterAdd`, `raceOnUniqueIndexMapsToDuplicate` (fake repo throws on save → still `DuplicateDocumentException`, stored object removed).
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `AttachmentService` (`@ApplicationScoped`, `@Transactional` where it writes). Order: active owner → event exists (404) → period check → limit → policy check on first 8 bytes → stream to temp file computing SHA-256 → duplicate lookup → `put` object → `save` row; on any failure after `put`, `delete` the object. Storage key `attachments/<vin>/<attachmentId>`. Delete of the event cascades soft-delete of its attachments.
- [ ] **Step 4:** Run the unit tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(server): attachment use cases`.

### Task 5: REST API, scan source, document alias

**Files:**
- Create: `AttachmentResource.java`, `AttachmentResponse.java`, `AttachmentDtoMapper.java`, `src/integration-test/resources/features/event/attachments.feature`, `.../steps/AttachmentSteps.java`
- Modify: `EventResponse.java`/`EventDtoMapper.java`/`EventView.java` (`attachmentCount`, and `documentPresent = attachmentCount > 0`), `EventService.get(...)` for `/document` (first live attachment), `ScanService` + `scan_job` (new `V7__scan_job_sha256.sql` adding nullable `sha256 char(64)`), `SaveConfirmedEventCommand`/`ConfirmedEvent` (add `sha256`, `sizeBytes`), `EventService.saveConfirmed` (insert a `SCAN_SOURCE` attachment instead of writing `document_key`)
- Modify: `shared/error` mapper registrations if codes are mapped centrally.

**Interfaces:**
- Consumes: Task 4 use cases. Produces HTTP shapes from the contract (Task 1) and `EventResponse.attachmentCount`.
- `ScanService.submit(...)` computes the SHA-256 of the stored bytes and saves it on the job (no duplicate rejection, per spec §9).

- [ ] **Step 1:** Write `attachments.feature` scenarios: add → list → open → delete; "same file twice on one VIN → 409 `duplicate-document`"; "same bytes on another user's VIN → 201"; "prior owner gets 403 `event-from-prior-owner` on add and `document-restricted` on open"; "11th file → 422 `attachment-limit`"; "text file renamed `.pdf` → 415"; "timeline shows `attachmentCount` 2 and `documentPresent` true while evidence stays USER_CONFIRMED"; "confirmed scan event lists a SCAN_SOURCE that cannot be deleted → 422 `attachment-protected`"; "GET /document still returns the first attachment".
- [ ] **Step 2:** Run the feature; expect FAIL.
- [ ] **Step 3:** Implement resource, DTOs, mapper, the `EventView` change, the scan hash + `SCAN_SOURCE` creation and `V7`. Multipart streaming via the same RESTEasy mechanism `ScanResource` uses.
- [ ] **Step 4:** Run the whole server suite (`mvn -q verify` or the MCP tool). Expected: PASS, including existing scan and passport features (snapshot output unchanged).
- [ ] **Step 5:** Commit `feat(server): attachments API`.

### Task 6: Mobile — ConfirmSheet children slot

**Files:**
- Modify: `mobile/src/shared/design/primitives/ConfirmSheet.tsx`, `mobile/src/shared/design/primitives.test.tsx`

**Interfaces:**
- Produces: `ConfirmSheet` prop `children?: ReactNode`, rendered between `body` and the buttons; `body` stays required but may be empty-string-free (callers keep passing it).

- [ ] **Step 1:** Add test `renders children between body and buttons` (testing-library): render with `children={<Text>row</Text>}`, assert it is present and the confirm button is still the first button.
- [ ] **Step 2:** Run `npx jest src/shared/design/primitives.test.tsx`; expect FAIL.
- [ ] **Step 3:** Add the prop; no style changes to the existing layout.
- [ ] **Step 4:** Run the same test plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(mobile): ConfirmSheet accepts content`.

### Task 7: Mobile — verification sheet on Save

**Files:**
- Create: `features/event/model/eventSummary.ts`, `eventSummary.test.ts`
- Modify: `EventFormScreen.tsx`, `shared/i18n/en.ts` (`event.check.*`), `mobile/features/timeline.feature` + `test/steps/timeline.steps.tsx` (or a new `event.check.test.tsx` in `test/steps/`)

**Interfaces:**
- Produces: `eventSummary(values: EventForm, documents: number): { label: string; value: string; emphasis?: boolean }[]` (odometer row has `emphasis: true`, formatted `148 200 km`).
- Copy (exact): title `Check before saving`, body `Everything below ends up in the car's history.`, confirm `Yes, these are correct`, dismiss `Go back and edit`.

- [ ] **Step 1:** Write `eventSummary.test.ts` (rows and order: type, date, odometer, cost, notes if non-empty, documents if > 0) and a screen test: `Save opens the sheet with the entered facts`, `Go back keeps the form and posts nothing`, `confirm posts exactly once even when tapped twice`, `an invalid form shows field errors and no sheet`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** In `EventFormScreen`, `handleSubmit` now opens the sheet with the summary; confirm closes the sheet first, then calls `save.mutate`. Applies to add and edit; documented (read-only) edit still has no Save.
- [ ] **Step 4:** Run `npx jest` for the touched tests and `npm run lint`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(mobile): verify event before saving`.

### Task 8: Mobile — attachment API layer and fake API

**Files:**
- Create: `features/event/api/useAttachments.ts`, `useUploadAttachments.ts`, `useDeleteAttachment.ts`, `useOpenAttachment.ts`
- Modify: `test/fake-api/handlers.ts`, `builders.ts`, `contract.ts` as needed, `shared/api` query keys (`qk.attachments(vin, eventId)`), `src/features/event/index.ts`

**Interfaces:**
- Produces: `useAttachments(vin, eventId)` → `AttachmentResponse[]`; `uploadAttachments(vin, eventId, files: PreparedFile[]) → { uploaded: AttachmentResponse[]; failed: { index: number; code: string | null }[] }` (sequential; a `duplicate-document` is a failure with that code, others continue); `useDeleteAttachment(vin, eventId)`; `useOpenAttachment(vin, eventId, attachmentId, baseName)` (same pattern as `useEventDocument`). All mutations invalidate `qk.timeline(vin)` and `qk.attachments`.
- Fake API: handlers for the four operations with the same status codes and dedup by file content hash.

- [ ] **Step 1:** Write `test/fake-api/fake.test.ts` cases: add returns 201, same bytes twice → 409 `duplicate-document`, 11th → 422, delete of `SCAN_SOURCE` → 422; and let `operations-covered.test.ts` drive the hook usage.
- [ ] **Step 2:** Run `npx jest test/fake-api test/operations-covered.test.ts`; expect FAIL.
- [ ] **Step 3:** Implement hooks and handlers.
- [ ] **Step 4:** Run the same tests. Expected: PASS (this clears the red left by Task 1).
- [ ] **Step 5:** Commit `feat(mobile): attachment api hooks`.

### Task 9: Mobile — Documents section and staged upload

**Files:**
- Create: `features/event/model/stagedFiles.ts` (+ test), `features/event/components/DocumentsSection.tsx`
- Modify: `EventFormScreen.tsx`, `package.json` (`npx expo install expo-document-picker`), `shared/i18n/en.ts`, `app.json` plugins if the package requires it

**Interfaces:**
- Consumes: `preparePhoto` (scan feature; import through `features/scan/index.ts`, add a re-export if missing), `uploadAttachments` (Task 8).
- Produces: `stagedFiles` helpers `addStaged(list, picked, max = 10) → { list, overflow: boolean }`, `removeStaged(list, index)`; `DocumentsSection` props `{ files: StagedFile[]; onChange(files): void; disabled?: boolean }` with buttons Take photo / Choose photo / Choose PDF and the caption `Up to 10 files, 10 MB each`.
- Create flow: `add.mutate` → on success `uploadAttachments`; all ok → `close`; some failed → navigate to the event detail with a `failedUploads` param count.

- [ ] **Step 1:** Write `stagedFiles.test.ts` (limit 10, overflow flag, PDF over 10 MB rejected with message key) and screen tests: `staged files upload after the event is created`, `a duplicate file is reported and skipped`, `event is kept when an upload fails`, `files can be removed before saving`, `summary sheet shows "2 files"`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement. PDFs are not run through `preparePhoto`; size check client-side before staging.
- [ ] **Step 4:** Run tests, `npm run typecheck`, `npm run lint`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(mobile): attach documents to events`.

### Task 10: Mobile — detail list, retry banner, timeline marker

**Files:**
- Create: `features/event/components/AttachmentList.tsx`
- Modify: `EventDetailScreen.tsx`, `TimelineItem.tsx`, `shared/i18n/en.ts`, `test/fake-api/builders.ts` (`attachmentCount`)

**Interfaces:**
- Consumes: Task 8 hooks, `ConfirmSheet` for delete.
- Produces: detail shows the list (tap opens, `UPLOAD` rows deletable, `SCAN_SOURCE` rows not), an "Add document" action, and, when `failedUploads > 0`, the banner `N of M documents did not upload` with Retry. `TimelineItem` shows a paperclip and count when `attachmentCount > 0`; the evidence badge is unchanged. A later owner sees only `N documents` with the existing restricted copy.

- [ ] **Step 1:** Write tests: `detail lists attachments and opens one`, `delete asks first and removes it`, `scan source has no delete`, `failed upload banner retries`, `timeline shows paperclip with count`, `later owner sees count but no list`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement the components and strings.
- [ ] **Step 4:** Run the full mobile suite: `npm test`, `npm run typecheck`, `npm run lint`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(mobile): event documents on detail and timeline`.

---

## Self-Review

- **Spec coverage:** §3 decision B → Task 4 (`evidenceOfManualEventUnchangedAfterAdd`) and Task 5 scenario; §5 data/rules/shared/storage → Tasks 2–5; §6 contract → Task 1; §7 form, create flow, sheet, detail, timeline → Tasks 6–10; §8 tests are inside each task; §9 calls (limit 10, scan no-reject, legacy no hash) → Tasks 3, 4, 5.
- **Gap added vs spec:** event soft-delete cascades to attachments (Review Focus line 3) — my call, added to Task 4.
- **Types:** `AttachmentView`/`AttachmentResponse` fields identical across Tasks 1, 4, 5, 8; `uploadAttachments` result shape used the same in Tasks 8 and 9; `ConfirmSheet.children` defined in Task 6, used in Task 7.
- **Known red window:** mobile `operations-covered` / fake-API tests fail between Tasks 1 and 8 by design.
