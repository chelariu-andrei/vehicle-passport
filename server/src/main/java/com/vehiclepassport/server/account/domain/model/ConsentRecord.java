package com.vehiclepassport.server.account.domain.model;

import java.time.Instant;
import java.util.UUID;

/** Append-only consent event. {@code version} is null for marketing and analytics. */
public record ConsentRecord(
        UUID id,
        UUID userId,
        String subjectHash,
        ConsentType type,
        String version,
        boolean granted,
        ConsentSource source,
        Instant createdAt) {
}
