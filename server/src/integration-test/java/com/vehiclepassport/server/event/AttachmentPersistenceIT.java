package com.vehiclepassport.server.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.exception.DuplicateDocumentException;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class AttachmentPersistenceIT {

    private static final Instant T0 = Instant.parse("2025-06-01T10:00:00Z");
    private static final String HASH_A = "a".repeat(64);
    private static final String HASH_B = "b".repeat(64);

    /** Same statement as the backfill in V6, made re-runnable. */
    private static final String BACKFILL = """
            insert into vehicle_passport.event_attachment
                (id, event_id, vin, sha256, content_type, size_bytes, storage_key, kind, created_by, created_at)
            select gen_random_uuid(), e.id, e.vin, null, 'application/octet-stream', 0, e.document_key,
                   'SCAN_SOURCE', e.created_by, e.created_at
            from vehicle_passport.vehicle_event e
            where e.document_key is not null and e.id = ?1
              and not exists (select 1 from vehicle_passport.event_attachment a
                              where a.event_id = e.id and a.kind = 'SCAN_SOURCE'
                                and a.storage_key = e.document_key)
            """;

    @Inject
    AttachmentRepositoryPort attachments;
    @Inject
    EventRepositoryPort events;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AssertActiveOwnerUseCase owners;
    @Inject
    EntityManager em;

    private record Fixture(String vin, UUID owner, UUID period) {
    }

    private Fixture fixture() {
        String vin = EventTestVins.random();
        UUID owner = UUID.randomUUID();
        registering.register(new RegisterVehicleCommand(owner, vin, "Dacia", "Duster", null, 2020, "DIESEL"));
        return new Fixture(vin, owner, owners.assertActiveOwner(vin, owner).periodId());
    }

    private UUID event(Fixture f, String documentKey) {
        UUID id = UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> events.save(new VehicleEvent(id, f.vin(), EventType.SERVICE,
                LocalDate.parse("2025-03-01"), 1000, new BigDecimal("10.50"), "RON", null, null, null, null,
                Set.of(), List.of(), EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, f.owner(), f.period(), documentKey, T0, null)));
        return id;
    }

    private Attachment attachment(Fixture f, UUID eventId, String sha, AttachmentKind kind) {
        UUID id = UUID.randomUUID();
        return new Attachment(id, eventId, f.vin(), sha, "image/png", 123, "attachments/" + f.vin() + "/" + id, kind,
                f.owner(), T0, null);
    }

    private void save(Attachment a) {
        QuarkusTransaction.requiringNew().run(() -> attachments.save(a));
    }

    @Test
    void savesAndListsLive() {
        Fixture f = fixture();
        UUID eventId = event(f, null);
        Attachment first = attachment(f, eventId, HASH_A, AttachmentKind.UPLOAD);
        Attachment second = new Attachment(UUID.randomUUID(), eventId, f.vin(), HASH_B, "application/pdf", 9,
                "k2", AttachmentKind.UPLOAD, f.owner(), T0.plusSeconds(5), null);
        save(first);
        save(second);

        List<Attachment> live = QuarkusTransaction.requiringNew().call(() -> attachments.liveFor(eventId));
        assertEquals(List.of(first, second), live);
        assertEquals(2, QuarkusTransaction.requiringNew().call(() -> attachments.countLive(eventId)));
        assertEquals(Map.of(eventId, 2),
                QuarkusTransaction.requiringNew().call(() -> attachments.countsFor(Set.of(eventId))));
        assertEquals(first, QuarkusTransaction.requiringNew()
                .call(() -> attachments.findLive(eventId, first.id())).orElseThrow());

        QuarkusTransaction.requiringNew().run(() -> attachments.softDelete(first.id(), T0.plusSeconds(60)));
        assertEquals(List.of(second), QuarkusTransaction.requiringNew().call(() -> attachments.liveFor(eventId)));
        assertTrue(QuarkusTransaction.requiringNew().call(() -> attachments.findLive(eventId, first.id())).isEmpty());

        QuarkusTransaction.requiringNew().run(() -> attachments.softDeleteAllFor(eventId, T0.plusSeconds(90)));
        assertEquals(0, QuarkusTransaction.requiringNew().call(() -> attachments.countLive(eventId)));
        assertTrue(QuarkusTransaction.requiringNew().call(() -> attachments.countsFor(Set.of(eventId))).isEmpty());
    }

    @Test
    void duplicateUploadHashOnSameVinThrows() {
        Fixture f = fixture();
        UUID firstEvent = event(f, null);
        UUID secondEvent = event(f, null);
        save(attachment(f, firstEvent, HASH_A, AttachmentKind.UPLOAD));

        DuplicateDocumentException e = assertThrows(DuplicateDocumentException.class,
                () -> save(attachment(f, secondEvent, HASH_A, AttachmentKind.UPLOAD)));

        assertEquals(firstEvent, e.existingEventId());
        assertEquals("duplicate-document", e.code());
        assertEquals(firstEvent, QuarkusTransaction.requiringNew()
                .call(() -> attachments.findLiveUploadByHash(f.vin(), HASH_A)).orElseThrow().eventId());
    }

    @Test
    void sameHashOnOtherVinIsAllowed() {
        Fixture one = fixture();
        Fixture two = fixture();
        save(attachment(one, event(one, null), HASH_A, AttachmentKind.UPLOAD));
        UUID otherEvent = event(two, null);

        save(attachment(two, otherEvent, HASH_A, AttachmentKind.UPLOAD));

        assertEquals(1, QuarkusTransaction.requiringNew().call(() -> attachments.countLive(otherEvent)));
    }

    @Test
    void softDeletedHashCanBeReused() {
        Fixture f = fixture();
        UUID eventId = event(f, null);
        Attachment first = attachment(f, eventId, HASH_A, AttachmentKind.UPLOAD);
        save(first);
        QuarkusTransaction.requiringNew().run(() -> attachments.softDelete(first.id(), T0.plusSeconds(1)));
        assertFalse(QuarkusTransaction.requiringNew()
                .call(() -> attachments.findLiveUploadByHash(f.vin(), HASH_A)).isPresent());

        save(attachment(f, eventId, HASH_A, AttachmentKind.UPLOAD));

        assertEquals(1, QuarkusTransaction.requiringNew().call(() -> attachments.countLive(eventId)));
    }

    @Test
    void scanSourceIsExemptFromUniqueness() {
        Fixture f = fixture();
        UUID eventId = event(f, null);
        UUID otherEvent = event(f, null);
        save(attachment(f, eventId, HASH_A, AttachmentKind.SCAN_SOURCE));
        save(attachment(f, otherEvent, HASH_A, AttachmentKind.SCAN_SOURCE));
        // a legacy row has no hash at all, and an upload may reuse a scan source's hash
        save(attachment(f, eventId, null, AttachmentKind.SCAN_SOURCE));
        save(attachment(f, eventId, HASH_A, AttachmentKind.UPLOAD));

        assertEquals(3, QuarkusTransaction.requiringNew().call(() -> attachments.countLive(eventId)));
        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> attachments.findLiveUploadByHash(f.vin(), HASH_A)).isPresent());
    }

    @Test
    void migrationBackfillsDocumentKeyAsScanSource() {
        Fixture f = fixture();
        UUID withDocument = event(f, "scans/legacy-key");
        UUID without = event(f, null);

        int first = runBackfill(withDocument);
        int again = runBackfill(withDocument);
        int none = runBackfill(without);

        assertEquals(1, first);
        assertEquals(0, again);
        assertEquals(0, none);
        Attachment row = QuarkusTransaction.requiringNew().call(() -> attachments.liveFor(withDocument)).getFirst();
        assertEquals(AttachmentKind.SCAN_SOURCE, row.kind());
        assertEquals("scans/legacy-key", row.storageKey());
        assertEquals(null, row.sha256());
        assertEquals("application/octet-stream", row.contentType());
        assertEquals(0L, row.sizeBytes());
        assertEquals(f.owner(), row.createdBy());
    }

    @Test
    void concurrentDuplicateUploadLosesWithDuplicateDocument() throws Exception {
        Fixture f = fixture();
        UUID winnerEvent = event(f, null);
        UUID loserEvent = event(f, null);
        CountDownLatch inserted = new CountDownLatch(1);
        CountDownLatch commit = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<?> winner = pool.submit(() -> QuarkusTransaction.requiringNew().run(() -> {
                attachments.save(attachment(f, winnerEvent, HASH_A, AttachmentKind.UPLOAD));
                inserted.countDown();
                try {
                    commit.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            assertTrue(inserted.await(10, TimeUnit.SECONDS));
            Future<?> loser = pool.submit(() -> QuarkusTransaction.requiringNew()
                    .run(() -> attachments.save(attachment(f, loserEvent, HASH_A, AttachmentKind.UPLOAD))));
            Thread.sleep(500); // the loser's pre-check misses and its insert blocks on the uncommitted winner
            commit.countDown();
            winner.get(10, TimeUnit.SECONDS);

            ExecutionException e = assertThrows(ExecutionException.class, () -> loser.get(10, TimeUnit.SECONDS));
            DuplicateDocumentException dup = assertInstanceOf(DuplicateDocumentException.class, e.getCause());
            assertEquals(winnerEvent, dup.existingEventId());
        } finally {
            commit.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void scanSourceSaveIsNeverReportedAsDuplicate() {
        Fixture f = fixture();
        UUID eventId = event(f, null);
        save(attachment(f, eventId, HASH_A, AttachmentKind.UPLOAD));

        save(attachment(f, event(f, null), HASH_A, AttachmentKind.SCAN_SOURCE));
    }

    @Test
    void bulkSoftDeleteKeepsPendingChangesOfOtherEntities() {
        Fixture f = fixture();
        UUID eventId = event(f, null);
        save(attachment(f, eventId, HASH_A, AttachmentKind.UPLOAD));

        QuarkusTransaction.requiringNew().run(() -> {
            events.save(new VehicleEvent(eventId, f.vin(), EventType.SERVICE, LocalDate.parse("2025-03-01"), 1000,
                    new BigDecimal("10.50"), "RON", null, null, null, null, Set.of(), List.of(),
                    EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL,
                    f.owner(), f.period(), null, T0, T0.plusSeconds(30)));
            attachments.softDeleteAllFor(eventId, T0.plusSeconds(30));
        });

        assertTrue(QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), eventId)).isEmpty());
        assertEquals(0, QuarkusTransaction.requiringNew().call(() -> attachments.countLive(eventId)));
    }

    private int runBackfill(UUID eventId) {
        return QuarkusTransaction.requiringNew()
                .call(() -> em.createNativeQuery(BACKFILL).setParameter(1, eventId).executeUpdate());
    }
}
