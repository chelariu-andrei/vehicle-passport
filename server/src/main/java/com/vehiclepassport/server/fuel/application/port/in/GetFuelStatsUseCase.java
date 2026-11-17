package com.vehiclepassport.server.fuel.application.port.in;

import java.util.UUID;

public interface GetFuelStatsUseCase {

    /**
     * Stats of the caller's current ownership period. {@code period} is {@code 3m}, {@code 6m}, {@code 12m} or
     * {@code all}; anything else (null included) is 400 {@code validation-failed}.
     */
    FuelStatsView stats(UUID userId, String vin, String period);
}
