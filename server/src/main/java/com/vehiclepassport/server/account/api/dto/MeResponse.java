package com.vehiclepassport.server.account.api.dto;

import java.time.Instant;
import java.util.UUID;

public record MeResponse(
        UUID id,
        String email,
        boolean emailVerified,
        String displayName,
        String phone,
        Instant createdAt,
        Stats stats,
        Deletion deletion,
        Consent consent) {

    public record Stats(long vehicles, long events, long passports) {
    }

    public record Deletion(Instant scheduledFor) {
    }

    public record VersionState(String currentVersion, String acceptedVersion) {
    }

    public record Consent(boolean required, VersionState terms, VersionState privacy, boolean marketing,
            boolean analytics) {
    }
}
