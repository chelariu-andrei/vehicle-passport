package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

/** Used by the account purge: de-links everything the owner holds in this feature from their identity. */
public interface DetachOwnerUseCase {

    /** Idempotent. Technical history stays; the owner reference becomes {@code tombstone}. */
    void detach(UUID ownerId, UUID tombstone);
}
