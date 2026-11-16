package com.vehiclepassport.server.event.api.dto;

import java.time.Instant;
import java.util.UUID;

/** sha256 is null for legacy scan sources stored before hashing existed. kind is SCAN_SOURCE or UPLOAD. */
public record AttachmentResponse(UUID id, String contentType, long sizeBytes, String sha256, String kind,
        Instant createdAt) {
}
