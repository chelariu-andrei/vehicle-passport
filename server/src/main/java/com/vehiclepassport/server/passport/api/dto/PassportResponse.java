package com.vehiclepassport.server.passport.api.dto;

import java.time.Instant;
import java.util.UUID;

public record PassportResponse(UUID id, String vin, String publicUrl, String hash, String status, Instant createdAt,
        Instant expiresAt) {
}
