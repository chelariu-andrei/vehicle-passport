package com.vehiclepassport.server.account.domain.model;

import java.time.Instant;
import java.util.UUID;

/** Profile aggregate. {@code email}, {@code displayName}, {@code phone} and {@code deletionScheduledFor} may be null. */
public record Profile(
        UUID id,
        String email,
        DisplayName displayName,
        PhoneNumber phone,
        Instant createdAt,
        Instant deletionScheduledFor) {

    public boolean deletionScheduled() {
        return deletionScheduledFor != null;
    }
}
