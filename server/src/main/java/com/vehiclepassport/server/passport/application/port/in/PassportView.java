package com.vehiclepassport.server.passport.application.port.in;

import java.time.Instant;
import java.util.UUID;

public record PassportView(UUID id, String vin, String publicUrl, String hash, String status, Instant createdAt,
        Instant expiresAt) {
}
