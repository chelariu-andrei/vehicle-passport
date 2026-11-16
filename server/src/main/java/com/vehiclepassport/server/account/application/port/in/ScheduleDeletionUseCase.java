package com.vehiclepassport.server.account.application.port.in;

import java.time.Instant;
import java.util.UUID;

public interface ScheduleDeletionUseCase {

    /** Schedules the purge for now plus the grace period and returns that instant. */
    Instant schedule(UUID userId);
}
