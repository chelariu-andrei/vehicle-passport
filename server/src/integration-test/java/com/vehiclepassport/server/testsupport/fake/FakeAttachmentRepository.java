package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.domain.exception.DuplicateDocumentException;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

/** Mirrors the table, including the unique (vin, sha256) index on live UPLOAD rows. */
@Alternative
@ApplicationScoped
public class FakeAttachmentRepository implements AttachmentRepositoryPort, Resettable {

    private final Map<UUID, Attachment> store = new LinkedHashMap<>();

    @Override
    public void save(Attachment attachment) {
        if (attachment.kind() == AttachmentKind.UPLOAD && attachment.deletedAt() == null
                && attachment.sha256() != null) {
            findLiveUploadByHash(attachment.vin(), attachment.sha256())
                    .filter(existing -> !existing.id().equals(attachment.id()))
                    .ifPresent(existing -> {
                        throw new DuplicateDocumentException(existing.eventId());
                    });
        }
        store.put(attachment.id(), attachment);
    }

    @Override
    public Optional<Attachment> findLive(UUID eventId, UUID id) {
        return live().filter(a -> a.eventId().equals(eventId) && a.id().equals(id)).findFirst();
    }

    @Override
    public List<Attachment> liveFor(UUID eventId) {
        return live().filter(a -> a.eventId().equals(eventId))
                .sorted(Comparator.comparing(Attachment::createdAt).thenComparing(Attachment::id)).toList();
    }

    @Override
    public int countLive(UUID eventId) {
        return (int) live().filter(a -> a.eventId().equals(eventId)).count();
    }

    @Override
    public Optional<Attachment> findLiveUploadByHash(String vin, String sha256) {
        return live().filter(a -> a.kind() == AttachmentKind.UPLOAD && a.vin().equals(vin)
                && sha256.equals(a.sha256())).findFirst();
    }

    @Override
    public void softDelete(UUID id, Instant at) {
        Attachment a = store.get(id);
        if (a != null && a.deletedAt() == null) {
            store.put(id, deleted(a, at));
        }
    }

    @Override
    public void softDeleteAllFor(UUID eventId, Instant at) {
        live().filter(a -> a.eventId().equals(eventId)).toList().forEach(a -> store.put(a.id(), deleted(a, at)));
    }

    @Override
    public Map<UUID, Integer> countsFor(Collection<UUID> eventIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        live().filter(a -> eventIds.contains(a.eventId())).forEach(a -> counts.merge(a.eventId(), 1, Integer::sum));
        return counts;
    }

    @Override
    public void reset() {
        store.clear();
    }

    private Stream<Attachment> live() {
        return store.values().stream().filter(a -> a.deletedAt() == null);
    }

    private static Attachment deleted(Attachment a, Instant at) {
        return new Attachment(a.id(), a.eventId(), a.vin(), a.sha256(), a.contentType(), a.sizeBytes(),
                a.storageKey(), a.kind(), a.createdBy(), a.createdAt(), at);
    }

    /** Not exercised through fakes: the purge runs against real persistence in AccountPurgeIT. */
    @Override
    public void detachCreator(UUID userId, UUID tombstone) {
    }
}
