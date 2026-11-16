package com.vehiclepassport.server.event.application;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AttachmentUpload;
import com.vehiclepassport.server.event.application.port.in.AttachmentView;
import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.DocumentStoragePort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.event.application.service.AttachmentService;
import com.vehiclepassport.server.event.application.service.EventService;
import com.vehiclepassport.server.event.domain.exception.AttachmentLimitException;
import com.vehiclepassport.server.event.domain.exception.AttachmentNotFoundException;
import com.vehiclepassport.server.event.domain.exception.AttachmentProtectedException;
import com.vehiclepassport.server.event.domain.exception.DocumentRestrictedException;
import com.vehiclepassport.server.event.domain.exception.DuplicateDocumentException;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.event.domain.exception.PriorPeriodEventException;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.shared.error.FileTooLargeException;
import com.vehiclepassport.server.shared.error.UnsupportedFileException;
import com.vehiclepassport.server.shared.util.UploadPolicy;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AttachmentServiceTest {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String OTHER_VIN = "WVWZZZ1JZXW000002";
    private static final byte[] PDF = "%PDF-1.7\nhello\n".getBytes(StandardCharsets.US_ASCII);
    private static final String PDF_SHA256 = "44cad0315db50ccf6b1a22a9759df441eea5289f4defc2861c233bc032b470e6";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-15T10:00:00Z"), ZoneOffset.UTC);

    private final UUID user = UUID.randomUUID();
    private final UUID otherUser = UUID.randomUUID();
    private final UUID period = UUID.randomUUID();
    private final UUID otherPeriod = UUID.randomUUID();

    private FakeEvents events;
    private FakeAttachments attachments;
    private FakeStorage storage;
    private Map<String, OwnedPeriod> activeOwner;
    private AttachmentService service;

    @BeforeEach
    void setUp() {
        events = new FakeEvents();
        attachments = new FakeAttachments();
        storage = new FakeStorage();
        activeOwner = new HashMap<>();
        activeOwner.put(VIN + user, new OwnedPeriod(VIN, period));
        activeOwner.put(OTHER_VIN + otherUser, new OwnedPeriod(OTHER_VIN, otherPeriod));
        ActiveOwnerPort owners = (vin, userId) -> {
            OwnedPeriod owned = activeOwner.get(vin + userId);
            if (owned == null) {
                throw new EventNotFoundException("not the active owner");
            }
            return owned;
        };
        service = new AttachmentService(events, owners, attachments, storage, CLOCK);
    }

    @Test
    void addStoresHashOfRawBytes() throws IOException {
        VehicleEvent event = events.add(manual(VIN, period));

        AttachmentView view = service.add(user, VIN, event.id(), pdf(PDF));

        assertEquals(PDF_SHA256, view.sha256());
        assertEquals("application/pdf", view.contentType());
        assertEquals(PDF.length, view.sizeBytes());
        assertEquals("UPLOAD", view.kind());
        assertEquals(CLOCK.instant(), view.createdAt());
        Attachment saved = attachments.rows.get(view.id());
        assertEquals("attachments/" + VIN + "/" + view.id(), saved.storageKey());
        assertEquals(user, saved.createdBy());
        assertArrayEquals(PDF, storage.objects.get(saved.storageKey()));
        assertEquals("application/pdf", storage.types.get(saved.storageKey()));
        assertFalse(Files.exists(storage.lastPutPath), "temp file must be deleted");
    }

    @Test
    void duplicateOnSameVinThrowsDuplicateDocument() {
        VehicleEvent first = events.add(manual(VIN, period));
        VehicleEvent second = events.add(manual(VIN, period));
        service.add(user, VIN, first.id(), pdf(PDF));

        DuplicateDocumentException e = assertThrows(DuplicateDocumentException.class,
                () -> service.add(user, VIN, second.id(), pdf(PDF)));

        assertEquals(first.id(), e.existingEventId());
        assertEquals(1, storage.objects.size(), "the duplicate must not be stored");
        assertFalse(Files.exists(storage.lastPutPath));
    }

    @Test
    void duplicateOfAPriorOwnersUploadDoesNotNameTheirEvent() {
        VehicleEvent prior = events.add(manual(VIN, period));
        service.add(user, VIN, prior.id(), pdf(PDF));
        UUID laterOwner = UUID.randomUUID();
        UUID laterPeriod = UUID.randomUUID();
        activeOwner.remove(VIN + user);
        activeOwner.put(VIN + laterOwner, new OwnedPeriod(VIN, laterPeriod));
        VehicleEvent mine = events.add(manual(VIN, laterPeriod));

        DuplicateDocumentException e = assertThrows(DuplicateDocumentException.class,
                () -> service.add(laterOwner, VIN, mine.id(), pdf(PDF)));

        assertNull(e.existingEventId());
        assertFalse(e.getMessage().contains(prior.id().toString()));
        assertFalse(e.getMessage().contains("null"));
    }

    @Test
    void raceLostToAPriorOwnersEventDoesNotNameIt() {
        VehicleEvent mine = events.add(manual(VIN, period));
        UUID elsewhere = events.add(manual(VIN, otherPeriod)).id();
        attachments.failNextSave = new DuplicateDocumentException(elsewhere);

        DuplicateDocumentException e = assertThrows(DuplicateDocumentException.class,
                () -> service.add(user, VIN, mine.id(), pdf(PDF)));

        assertNull(e.existingEventId());
    }

    @Test
    void duplicateWithoutAnEventIdHasAGenericMessage() {
        DuplicateDocumentException e = new DuplicateDocumentException(null);

        assertNull(e.existingEventId());
        assertEquals("This document is already attached to another event", e.getMessage());
    }

    @Test
    void laterOwnerGetsRestrictedBeforeAttachmentNotFound() {
        VehicleEvent event = events.add(manual(VIN, period));
        UUID laterOwner = UUID.randomUUID();
        activeOwner.remove(VIN + user);
        activeOwner.put(VIN + laterOwner, new OwnedPeriod(VIN, UUID.randomUUID()));

        assertThrows(DocumentRestrictedException.class,
                () -> service.open(laterOwner, VIN, event.id(), UUID.randomUUID()));
    }

    @Test
    void sameBytesOnOtherVinStored() {
        VehicleEvent mine = events.add(manual(VIN, period));
        VehicleEvent theirs = events.add(manual(OTHER_VIN, otherPeriod));
        service.add(user, VIN, mine.id(), pdf(PDF));

        AttachmentView view = service.add(otherUser, OTHER_VIN, theirs.id(), pdf(PDF));

        assertEquals(PDF_SHA256, view.sha256());
        assertEquals(2, storage.objects.size());
    }

    @Test
    void eleventhFileThrowsAttachmentLimit() {
        VehicleEvent event = events.add(manual(VIN, period));
        for (int i = 0; i < 10; i++) {
            service.add(user, VIN, event.id(), pdf(("%PDF-1.7\n" + i).getBytes(StandardCharsets.US_ASCII)));
        }

        assertThrows(AttachmentLimitException.class, () -> service.add(user, VIN, event.id(),
                pdf("%PDF-1.7\neleven".getBytes(StandardCharsets.US_ASCII))));
        assertEquals(10, storage.objects.size());
    }

    @Test
    void priorPeriodEventRejectsAdd() {
        VehicleEvent old = events.add(manual(VIN, UUID.randomUUID()));

        assertThrows(PriorPeriodEventException.class, () -> service.add(user, VIN, old.id(), pdf(PDF)));
        assertTrue(storage.objects.isEmpty());
    }

    @Test
    void unknownEventIsNotFound() {
        assertThrows(EventNotFoundException.class, () -> service.add(user, VIN, UUID.randomUUID(), pdf(PDF)));
    }

    @Test
    void laterOwnerCannotOpen() {
        VehicleEvent event = events.add(manual(VIN, period));
        AttachmentView view = service.add(user, VIN, event.id(), pdf(PDF));
        UUID laterOwner = UUID.randomUUID();
        activeOwner.remove(VIN + user);
        activeOwner.put(VIN + laterOwner, new OwnedPeriod(VIN, UUID.randomUUID()));

        assertThrows(DocumentRestrictedException.class,
                () -> service.open(laterOwner, VIN, event.id(), view.id()));
        assertThrows(DocumentRestrictedException.class, () -> service.list(laterOwner, VIN, event.id()));
        assertThrows(PriorPeriodEventException.class,
                () -> service.delete(laterOwner, VIN, event.id(), view.id()));
    }

    @Test
    void openReturnsStoredFile() throws IOException {
        VehicleEvent event = events.add(manual(VIN, period));
        AttachmentView view = service.add(user, VIN, event.id(), pdf(PDF));

        EventDocument doc = service.open(user, VIN, event.id(), view.id());

        assertEquals("application/pdf", doc.contentType());
        try (InputStream in = doc.content()) {
            assertArrayEquals(PDF, in.readAllBytes());
        }
    }

    @Test
    void openLegacyScanSourceReportsRealContentType() throws IOException {
        VehicleEvent event = events.add(manual(VIN, period));
        byte[] png = {(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
        Attachment legacy = new Attachment(UUID.randomUUID(), event.id(), VIN, null, "application/octet-stream",
                png.length, "scans/legacy-key", AttachmentKind.SCAN_SOURCE, user, CLOCK.instant(), null);
        attachments.rows.put(legacy.id(), legacy);
        storage.objects.put("scans/legacy-key", png);
        storage.types.put("scans/legacy-key", "application/octet-stream");

        List<AttachmentView> listed = service.list(user, VIN, event.id());
        assertNull(listed.get(0).sha256());
        EventDocument doc = service.open(user, VIN, event.id(), legacy.id());

        assertEquals("image/png", doc.contentType());
        try (InputStream in = doc.content()) {
            assertArrayEquals(png, in.readAllBytes(), "sniffing must not consume the stream");
        }
    }

    @Test
    void openUnknownAttachmentIsAttachmentNotFound() {
        VehicleEvent event = events.add(manual(VIN, period));

        assertThrows(AttachmentNotFoundException.class,
                () -> service.open(user, VIN, event.id(), UUID.randomUUID()));
        assertThrows(AttachmentNotFoundException.class,
                () -> service.delete(user, VIN, event.id(), UUID.randomUUID()));
    }

    @Test
    void listReturnsLiveAttachmentsOldestFirst() {
        VehicleEvent event = events.add(manual(VIN, period));
        AttachmentView a = service.add(user, VIN, event.id(), pdf(PDF));
        AttachmentView b = service.add(user, VIN, event.id(), pdf("%PDF-1.7\nb".getBytes(StandardCharsets.US_ASCII)));
        service.delete(user, VIN, event.id(), a.id());

        assertEquals(List.of(b.id()), service.list(user, VIN, event.id()).stream().map(AttachmentView::id).toList());
    }

    @Test
    void deleteScanSourceThrowsProtected() {
        VehicleEvent event = events.add(manual(VIN, period));
        Attachment scan = new Attachment(UUID.randomUUID(), event.id(), VIN, PDF_SHA256, "application/pdf",
                PDF.length, "scans/k", AttachmentKind.SCAN_SOURCE, user, CLOCK.instant(), null);
        attachments.rows.put(scan.id(), scan);

        assertThrows(AttachmentProtectedException.class, () -> service.delete(user, VIN, event.id(), scan.id()));
        assertNull(attachments.rows.get(scan.id()).deletedAt());
    }

    @Test
    void deleteUploadFreesHash() {
        VehicleEvent event = events.add(manual(VIN, period));
        AttachmentView first = service.add(user, VIN, event.id(), pdf(PDF));

        service.delete(user, VIN, event.id(), first.id());

        assertEquals(CLOCK.instant(), attachments.rows.get(first.id()).deletedAt());
        AttachmentView again = service.add(user, VIN, event.id(), pdf(PDF));
        assertEquals(PDF_SHA256, again.sha256());
    }

    @Test
    void addToDocumentedEventAllowedAndKeepsEvidence() {
        VehicleEvent documented = events.add(event(VIN, period, EvidenceLevel.DOCUMENTED, EventSource.SCAN));

        service.add(user, VIN, documented.id(), pdf(PDF));

        assertEquals(documented, events.rows.get(documented.id()));
        assertEquals(0, events.saves, "attachments never change the event");
    }

    @Test
    void evidenceOfManualEventUnchangedAfterAdd() {
        VehicleEvent manual = events.add(manual(VIN, period));

        service.add(user, VIN, manual.id(), pdf(PDF));

        assertEquals(EvidenceLevel.USER_CONFIRMED, events.rows.get(manual.id()).evidence());
        assertEquals(0, events.saves);
    }

    @Test
    void raceOnUniqueIndexMapsToDuplicate() {
        VehicleEvent event = events.add(manual(VIN, period));
        UUID winnerEvent = events.add(manual(VIN, period)).id();
        // the pre-check sees nothing; the insert then loses to a concurrent identical upload
        attachments.failNextSave = new DuplicateDocumentException(winnerEvent);

        DuplicateDocumentException e = assertThrows(DuplicateDocumentException.class,
                () -> service.add(user, VIN, event.id(), pdf(PDF)));

        assertEquals(winnerEvent, e.existingEventId());
        assertEquals(1, storage.puts, "the object was put before the insert");
        assertTrue(storage.objects.isEmpty(), "the stored object must be removed when the insert fails");
        assertFalse(Files.exists(storage.lastPutPath));
    }

    @Test
    void failedObjectCleanupDoesNotHideTheOriginalError() {
        VehicleEvent event = events.add(manual(VIN, period));
        attachments.failNextSave = new DuplicateDocumentException(null);
        storage.failDelete = true;

        assertThrows(DuplicateDocumentException.class, () -> service.add(user, VIN, event.id(), pdf(PDF)));
    }

    @Test
    void wrongMagicBytesRejected() {
        VehicleEvent event = events.add(manual(VIN, period));
        byte[] notPdf = "hello world".getBytes(StandardCharsets.US_ASCII);

        assertThrows(UnsupportedFileException.class, () -> service.add(user, VIN, event.id(),
                new AttachmentUpload(new ByteArrayInputStream(notPdf), "application/pdf", notPdf.length)));
        assertTrue(storage.objects.isEmpty());
    }

    @Test
    void sizeIsEnforcedOnActualBytesNotDeclaredSize() {
        VehicleEvent event = events.add(manual(VIN, period));
        byte[] big = new byte[(int) UploadPolicy.MAX_BYTES + 1];
        System.arraycopy(PDF, 0, big, 0, PDF.length);

        assertThrows(FileTooLargeException.class, () -> service.add(user, VIN, event.id(),
                new AttachmentUpload(new ByteArrayInputStream(big), "application/pdf", 100)));
        assertTrue(storage.objects.isEmpty());
        assertTrue(attachments.rows.isEmpty());
    }

    @Test
    void declaredOversizeRejectedBeforeStreaming() {
        VehicleEvent event = events.add(manual(VIN, period));

        assertThrows(FileTooLargeException.class, () -> service.add(user, VIN, event.id(),
                new AttachmentUpload(new ByteArrayInputStream(PDF), "application/pdf", UploadPolicy.MAX_BYTES + 1)));
    }

    @Test
    void eventDeleteSoftDeletesItsAttachmentsAndFreesHashes() {
        VehicleEvent event = events.add(manual(VIN, period));
        AttachmentView view = service.add(user, VIN, event.id(), pdf(PDF));
        EventService eventService = new EventService(events, (vin, u) -> activeOwner.get(vin + u), attachments,
                CLOCK);

        eventService.delete(user, VIN, event.id());

        assertEquals(CLOCK.instant(), attachments.rows.get(view.id()).deletedAt());
        VehicleEvent other = events.add(manual(VIN, period));
        assertEquals(PDF_SHA256, service.add(user, VIN, other.id(), pdf(PDF)).sha256());
    }

    private static AttachmentUpload pdf(byte[] bytes) {
        return new AttachmentUpload(new ByteArrayInputStream(bytes), "application/pdf", bytes.length);
    }

    private static VehicleEvent manual(String vin, UUID periodId) {
        return event(vin, periodId, EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL);
    }

    private static VehicleEvent event(String vin, UUID periodId, EvidenceLevel evidence, EventSource source) {
        return new VehicleEvent(UUID.randomUUID(), vin, EventType.SERVICE, LocalDate.parse("2026-03-01"), 1000,
                BigDecimal.TEN, "RON", null, null, evidence, source, UUID.randomUUID(), periodId, null,
                Instant.parse("2026-03-01T10:00:00Z"), null);
    }

    private static final class FakeEvents implements EventRepositoryPort {
        final Map<UUID, VehicleEvent> rows = new LinkedHashMap<>();
        int saves;

        VehicleEvent add(VehicleEvent e) {
            rows.put(e.id(), e);
            return e;
        }

        public void lockTimeline(String vin) { }

        public long countActiveByCreator(UUID userId) { return 0; }

        public List<VehicleEvent> activeByCreator(UUID userId) { return List.of(); }

        public void detachCreator(UUID userId, UUID tombstone) { }

        public Optional<VehicleEvent> findActive(String vin, UUID id) {
            return Optional.ofNullable(rows.get(id)).filter(e -> e.vin().equals(vin) && e.deletedAt() == null);
        }

        public Neighbours neighbours(String vin, LocalDate d, Instant c, UUID x) { return null; }

        public void save(VehicleEvent e) {
            saves++;
            rows.put(e.id(), e);
        }

        public List<VehicleEvent> page(String vin, TimelineCursor a, int l) { return List.of(); }

        public List<VehicleEvent> allActive(String vin) { return List.of(); }
    }

    /** Enforces the (vin, sha256) uniqueness of live uploads, like the repository and its index do. */
    static final class FakeAttachments implements AttachmentRepositoryPort {
        final Map<UUID, Attachment> rows = new LinkedHashMap<>();
        RuntimeException failNextSave;

        public void detachCreator(UUID userId, UUID tombstone) { }

        public void save(Attachment a) {
            if (failNextSave != null) {
                RuntimeException e = failNextSave;
                failNextSave = null;
                throw e;
            }
            if (a.kind() == AttachmentKind.UPLOAD && a.sha256() != null) {
                findLiveUploadByHash(a.vin(), a.sha256()).filter(x -> !x.id().equals(a.id())).ifPresent(x -> {
                    throw new DuplicateDocumentException(x.eventId());
                });
            }
            rows.put(a.id(), a);
        }

        public Optional<Attachment> findLive(UUID eventId, UUID id) {
            return Optional.ofNullable(rows.get(id)).filter(a -> a.eventId().equals(eventId) && a.deletedAt() == null);
        }

        public List<Attachment> liveFor(UUID eventId) {
            return rows.values().stream().filter(a -> a.eventId().equals(eventId) && a.deletedAt() == null).toList();
        }

        public int countLive(UUID eventId) {
            return liveFor(eventId).size();
        }

        public Optional<Attachment> findLiveUploadByHash(String vin, String sha256) {
            return rows.values().stream().filter(a -> a.deletedAt() == null && a.kind() == AttachmentKind.UPLOAD
                    && a.vin().equals(vin) && sha256.equals(a.sha256())).findFirst();
        }

        public void softDelete(UUID id, Instant at) {
            rows.computeIfPresent(id, (k, a) -> a.deletedAt() != null ? a : deleted(a, at));
        }

        public void softDeleteAllFor(UUID eventId, Instant at) {
            for (Attachment a : new ArrayList<>(rows.values())) {
                if (a.eventId().equals(eventId) && a.deletedAt() == null) {
                    rows.put(a.id(), deleted(a, at));
                }
            }
        }

        public Map<UUID, Integer> countsFor(Collection<UUID> eventIds) {
            Map<UUID, Integer> counts = new HashMap<>();
            for (UUID id : eventIds) {
                int n = countLive(id);
                if (n > 0) {
                    counts.put(id, n);
                }
            }
            return counts;
        }

        private static Attachment deleted(Attachment a, Instant at) {
            return new Attachment(a.id(), a.eventId(), a.vin(), a.sha256(), a.contentType(), a.sizeBytes(),
                    a.storageKey(), a.kind(), a.createdBy(), a.createdAt(), at);
        }
    }

    private static final class FakeStorage implements DocumentStoragePort {
        final Map<String, byte[]> objects = new HashMap<>();
        final Map<String, String> types = new HashMap<>();
        Path lastPutPath;
        int puts;
        boolean failDelete;

        public EventDocument open(String key) {
            byte[] bytes = objects.get(key);
            if (bytes == null) {
                throw new EventNotFoundException("no object");
            }
            return new EventDocument(new ByteArrayInputStream(bytes), types.get(key));
        }

        public void put(String key, Path file, String contentType) {
            puts++;
            lastPutPath = file;
            try {
                objects.put(key, Files.readAllBytes(file));
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
            types.put(key, contentType);
        }

        public void delete(String key) {
            if (failDelete) {
                throw new IllegalStateException("storage down");
            }
            objects.remove(key);
            types.remove(key);
        }
    }
}
