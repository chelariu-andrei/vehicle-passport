# Event attachments (receipts and estimates as evidence)

Date: 2026-11-15 · Scope: `contracts/`, `server/` (event feature), `mobile/` (event form, detail) · Status: draft for approval
Related: `2026-11-09-paddleocr-extraction-design.md` (OCR itself is **out of scope here**).

## 1. Intent

An event is only as trustworthy as what backs it. Today a document exists only when a scan was confirmed, and
`NoProviderExtractionAdapter` makes every scan fail, so in practice **no event can carry a document at all**.
The owner wants: when OCR works, its source file stays with the event; when it does not, the user enters the
data by hand **and uploads the receipt or estimate anyway**, and that file stays as evidence. The same file
must never be stored twice for the same car.

## 2. Goals / Non-goals / Anti-goals

**Goals**
- An event can hold 0..10 attachments (JPEG, PNG, PDF, ≤ 10 MB each): bonuri, devize, multi-page estimates.
- Server computes SHA-256 of the raw bytes; the same file cannot be attached twice to the same vehicle.
- Manual events can be created with attachments; existing events can gain or lose attachments later.
- On mobile, **Save always passes through a "check it carefully" sheet** that shows what will be stored.
- Attachments from a confirmed scan appear in the same list (one model, not two).

**Non-goals (v1)**
- OCR implementation, and any dedup at scan *submit* (scan only records the hash; see §7).
- Perceptual dedup (two different photos of one receipt), client-side hashing, thumbnails server-side.
- Putting attachment hashes into the passport snapshot (decided separately; snapshot format unchanged).
- Sharing attachments with later owners or buyers (stays owner-of-creating-period only, as today).

**Anti-goals**
- A manual attachment must **not** raise evidence. A user-supplied file with user-typed data proves nothing yet.
- Dedup must not leak across users: another user's upload of the same bytes is invisible and never conflicts.
- Never trust the declared content type; check magic bytes (existing rule).

## 3. Decisions the owner made

- Evidence stays `USER_CONFIRMED` for manual events with attachments (**option B**). `DOCUMENTED` stays reserved
  for data confirmed from an OCR scan. Manual events remain editable. The UI shows a document marker.
- Mobile: tapping Save opens a verification sheet ("are you sure?") listing the entered facts. It reuses the
  existing `ConfirmSheet`.
- OCR is added later; this work only prepares the manual path and the shared attachment model.

## 4. Approaches considered

1. **Attachments inside the `event` feature (chosen).** New table `event_attachment`, new use cases in
   `event/application`. Event ownership and period rules already live there; no cross-feature port needed.
2. Separate `attachment` feature behind ports. Cleaner on paper, but every call needs the event's owner and period,
   so it would end up calling back into `event` for everything. Rejected: ceremony without isolation gain.
3. Keep one `document_key` column and allow replacing it. Cheapest, but a multi-page estimate is the normal case
   and dedup needs a row per file. Rejected.

## 5. Backend design

**Data.** Flyway `V6__event_attachment.sql`:

```
event_attachment(id uuid pk, event_id uuid fk vehicle_event, vin varchar(17), sha256 char(64) null,
                 content_type varchar(100), size_bytes bigint, storage_key text, kind varchar(20),
                 created_by uuid, created_at timestamptz, deleted_at timestamptz null)
unique (vin, sha256) where kind = 'UPLOAD' and deleted_at is null   -- scan sources and legacy rows (sha256 may be null) are exempt
```

`kind`: `SCAN_SOURCE` (from a confirmed scan, cannot be deleted) or `UPLOAD`. Backfill: every
`vehicle_event.document_key` becomes one `SCAN_SOURCE` row with `sha256 = null`. The old column stays (read-only,
dropped in a later migration) so rollback is trivial.

**Rules (domain/application).**
- Add/list/open/delete require the active owner and an event created in the **active ownership period**;
  otherwise the existing `event-from-prior-owner` / `document-restricted` errors apply.
- Add: validate with the file policy → hash while streaming to a temp file → duplicate check on `(vin, sha256)`
  → store object → insert row. Duplicate ⇒ `409 duplicate-document`, the detail names the event it is already on.
- Max 10 live attachments per event ⇒ `422 attachment-limit`.
- Allowed on any event including `DOCUMENTED` (data is not touched); deleting a `SCAN_SOURCE` row is `422
  attachment-protected`. Deleting an `UPLOAD` is a soft delete; the hash is freed for re-upload.
- Evidence is never changed by attachments. `documentPresent` = at least one live attachment.
- Scan confirm: the existing path creates the `SCAN_SOURCE` row (with the hash computed at scan submit, stored on
  `scan_job`) instead of writing `document_key`.

**Shared.** `ScanFilePolicy` moves to `shared/util` as `UploadPolicy` (scan and event both use it; `shared` may not
depend on a feature, and event may not depend on scan).

**Storage.** Same S3 bucket and `StorageConfig`; key `attachments/<vin>/<attachmentId>`. A `port/out` for put/open/delete
(event already has `DocumentStoragePort`; extend it). Files are streamed, never fully buffered.

## 6. Contract (`openapi.yaml`, changed first)

- `POST /vehicles/{vin}/events/{eventId}/attachments` multipart `file` → `201 AttachmentResponse`
  (`id, contentType, sizeBytes, sha256, kind, createdAt`); `404`, `403 event-from-prior-owner`, `409 duplicate-document`,
  `413`, `415`, `422 attachment-limit`.
- `GET .../attachments` → list; `GET .../attachments/{attachmentId}` → file; `DELETE .../attachments/{attachmentId}` → `204`.
- `EventResponse` gains `attachmentCount` (integer, ≥ 0). `documentPresent` stays and stays consistent with it.
- `GET .../events/{eventId}/document` stays as a deprecated alias for the first attachment.
- The passport snapshot is unchanged.

## 7. Mobile design

**Add/edit event** (`EventFormScreen`): a "Documents" section under Notes: **Take photo**, **Choose photo**,
**Choose PDF** (adds `expo-document-picker`), thumbnails/chips with remove, "up to 10 files, 10 MB each".
Reuses `preparePhoto` (resize/JPEG) from scan.

**Create flow.** Files are staged locally. After the event is created, they upload one by one. If an upload fails the
event is **kept**, the user lands on the event detail with a "2 of 3 documents did not upload — Retry" banner. A
`409 duplicate-document` is shown as "Already attached to the <date> <type> entry" and skipped.

**Verification sheet.** `ConfirmSheet` gets an optional `children` slot (title/body/buttons unchanged). On Save, after
form validation passes, the sheet opens:

```
Check before saving
Everything below ends up in the car's history.
  Type        Service
  Date        2026-11-12
  Odometer    148 200 km        ← large; the field most often mistyped
  Cost        850 RON
  Notes       …
  Documents   2 files
[ Yes, these are correct ]   (primary)
[ Go back and edit ]         (quiet)
```

Applies to add and edit. The scan `ReviewScreen` keeps its own confirm. Only the first sheet confirm triggers the request;
the sheet is closed while the request is in flight so a double tap cannot double-post.

**Event detail.** Documents list (tap opens via the authenticated file endpoint), add more, delete for `UPLOAD`
rows with the existing delete `ConfirmSheet`. Later owners see only "N documents" with the existing restricted copy.
**Timeline item** shows a paperclip with the count when `attachmentCount > 0`; the evidence badge is unchanged.

## 8. Testing

- Server unit: hash and policy, duplicate rule, limit, `SCAN_SOURCE` protection, period/owner checks.
- Server integration (Cucumber, existing steps): add → list → open → delete; duplicate across two events of one VIN
  = 409; same bytes on another user's VIN = 201; prior owner gets 403; migration backfill.
- Mobile (Cucumber + testing-library, fake API): Save opens the sheet with entered facts; "Go back" keeps the form;
  confirm posts once; staged files upload after create; partial failure banner; duplicate message.
- Contract: regenerate `schema.d.ts`, fake API handlers updated.

## 9. Open / my calls (change if you disagree)

- Max 10 files per event (my call). HEIC is converted to JPEG on device by `preparePhoto`; the server accepts only JPEG/PNG/PDF.
- Duplicate means the same bytes on the same vehicle among live attachments, any event of it.
- Scan submit does **not** reject duplicates in v1: a scanned file that duplicates an existing attachment will simply
  also be stored. Revisit when OCR lands (cheapest fix: a `duplicate-document` warning on the scan job).
- Legacy rows have no hash, so they are not deduplicated; only files uploaded from now on are.
