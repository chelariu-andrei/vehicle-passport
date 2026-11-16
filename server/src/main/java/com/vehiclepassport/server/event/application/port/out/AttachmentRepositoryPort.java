package com.vehiclepassport.server.event.application.port.out;

import com.vehiclepassport.server.event.domain.model.Attachment;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** "Live" means not soft-deleted. */
public interface AttachmentRepositoryPort {

    /** Throws DuplicateDocumentException when a live UPLOAD with the same (vin, sha256) exists. */
    void save(Attachment attachment);

    Optional<Attachment> findLive(UUID eventId, UUID id);

    List<Attachment> liveFor(UUID eventId);

    int countLive(UUID eventId);

    Optional<Attachment> findLiveUploadByHash(String vin, String sha256);

    void softDelete(UUID id, Instant at);

    void softDeleteAllFor(UUID eventId, Instant at);

    /** Live attachment counts; events without any are absent from the map. */
    Map<UUID, Integer> countsFor(Collection<UUID> eventIds);

    /** Points every attachment uploaded by the user at {@code tombstone}. Safe to repeat. */
    void detachCreator(UUID userId, UUID tombstone);
}
