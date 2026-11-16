package com.vehiclepassport.server.account.application.port.out;

import java.util.UUID;

/** Reaches the vehicle, event, scan and passport features, which hold the owner's data. Both calls are idempotent. */
public interface OwnerDataEraserPort {

    void revokePassports(UUID ownerId);

    /** Closes ownerships and points every record the owner created at {@code tombstone}; history stays by VIN. */
    void detachOwnedData(UUID ownerId, UUID tombstone);
}
