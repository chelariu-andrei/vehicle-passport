package com.vehiclepassport.server.passport.domain.model;

import java.time.Instant;
import java.util.UUID;

public record Passport(
        UUID id, String vin, UUID createdBy, Instant createdAt, Snapshot snapshot, PublicLink link, String pdfKey) {

    public PassportStatus status(Instant now) {
        if (link.revokedAt() != null) {
            return PassportStatus.REVOKED;
        }
        if (!link.isOpen(now)) {
            return PassportStatus.EXPIRED;
        }
        return PassportStatus.ACTIVE;
    }
}
