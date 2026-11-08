package com.vehiclepassport.server.passport.domain.model;

import java.time.Instant;

public record PublicLink(String token, Instant expiresAt, Instant revokedAt) {

    public boolean isOpen(Instant now) {
        return revokedAt == null && (expiresAt == null || now.isBefore(expiresAt));
    }

    public PublicLink revoke(Instant now) {
        return revokedAt != null ? this : new PublicLink(token, expiresAt, now);
    }
}
