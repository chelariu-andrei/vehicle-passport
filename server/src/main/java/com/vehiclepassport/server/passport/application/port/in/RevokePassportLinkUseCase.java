package com.vehiclepassport.server.passport.application.port.in;

import java.util.UUID;

public interface RevokePassportLinkUseCase {

    /** Idempotent; only the creator may revoke. */
    void revoke(UUID userId, UUID passportId);
}
