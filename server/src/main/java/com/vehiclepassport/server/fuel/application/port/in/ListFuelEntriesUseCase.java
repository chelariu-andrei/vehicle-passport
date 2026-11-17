package com.vehiclepassport.server.fuel.application.port.in;

import java.util.UUID;

public interface ListFuelEntriesUseCase {

    /** {@code limit} is clamped to 1..100. */
    FuelEntryPage list(UUID userId, String vin, String cursor, int limit);
}
