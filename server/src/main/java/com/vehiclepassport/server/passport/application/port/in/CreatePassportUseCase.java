package com.vehiclepassport.server.passport.application.port.in;

import java.time.Instant;
import java.util.UUID;

public interface CreatePassportUseCase {

    /** expiresAt may be null (no expiry) but must be in the future. */
    PassportView create(UUID userId, String vin, Instant expiresAt);
}
