package com.vehiclepassport.server.fuel.application.port.in;

import java.util.UUID;

public interface DeleteFuelEntryUseCase {

    /** Soft delete; an unknown or already deleted entry is 404 {@code fuel-entry-not-found}. */
    void delete(UUID userId, String vin, UUID entryId);
}
