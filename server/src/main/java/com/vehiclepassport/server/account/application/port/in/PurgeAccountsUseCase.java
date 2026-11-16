package com.vehiclepassport.server.account.application.port.in;

import java.time.Instant;

public interface PurgeAccountsUseCase {

    /** Purges every account whose scheduled date is not after {@code now}; returns how many finished. */
    int purgeDue(Instant now);
}
