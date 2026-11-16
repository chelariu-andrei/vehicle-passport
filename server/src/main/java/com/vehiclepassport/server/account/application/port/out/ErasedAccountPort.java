package com.vehiclepassport.server.account.application.port.out;

import java.time.Instant;
import java.util.UUID;

/** Remembers the subjects whose account was purged, so their still valid access tokens are refused. */
public interface ErasedAccountPort {

    /** Safe to repeat. */
    void markErased(UUID userId, Instant at);

    boolean isErased(UUID userId);
}
