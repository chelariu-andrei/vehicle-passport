package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

/**
 * The status of the six documents of a VIN (deadlines spec §5.2). Same access rules as
 * {@link GetTimelineSummaryUseCase}: only the active owner sees them, anyone else gets vehicle-not-found.
 */
public interface DeadlinesUseCase {

    DeadlinesView get(UUID userId, String vin);
}
