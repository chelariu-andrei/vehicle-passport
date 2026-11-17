package com.vehiclepassport.server.fuel.application.port.in;

import java.util.UUID;

/** Used by the account purge. Fill-ups are personal usage data with no technical value for the car. */
public interface DetachOwnerUseCase {

    /**
     * Idempotent. Deletes every fill-up the owner created, on any car and in any period, soft-deleted ones included.
     * {@code tombstone} is part of the shared purge signature; nothing is handed to it here.
     */
    void detach(UUID ownerId, UUID tombstone);
}
