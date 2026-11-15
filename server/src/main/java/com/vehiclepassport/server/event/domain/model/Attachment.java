package com.vehiclepassport.server.event.domain.model;

import java.time.Instant;
import java.util.UUID;

/** A file attached to an event. sha256 is null for legacy rows backfilled from the old document key. */
public record Attachment(UUID id, UUID eventId, String vin, String sha256, String contentType, long sizeBytes,
        String storageKey, AttachmentKind kind, UUID createdBy, Instant createdAt, Instant deletedAt) {
}
