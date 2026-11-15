package com.vehiclepassport.server.event.application.port.in;

import java.time.Instant;
import java.util.UUID;

/** sha256 is null for legacy scan sources backfilled before hashing existed. kind is SCAN_SOURCE or UPLOAD. */
public record AttachmentView(UUID id, String contentType, long sizeBytes, String sha256, String kind,
        Instant createdAt) {
}
