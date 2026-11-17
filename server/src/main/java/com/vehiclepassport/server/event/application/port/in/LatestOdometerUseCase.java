package com.vehiclepassport.server.event.application.port.in;

import java.util.Optional;

public interface LatestOdometerUseCase {

    /** The highest odometer reading among the VIN's non-deleted events; empty when none has one. */
    Optional<Integer> latestKm(String vin);
}
