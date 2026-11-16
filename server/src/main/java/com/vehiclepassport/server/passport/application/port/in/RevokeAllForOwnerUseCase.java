package com.vehiclepassport.server.passport.application.port.in;

import java.util.UUID;

public interface RevokeAllForOwnerUseCase {

    /** Revokes every still-active passport link the owner created. Idempotent; returns how many were revoked. */
    int revokeAll(UUID ownerId);
}
