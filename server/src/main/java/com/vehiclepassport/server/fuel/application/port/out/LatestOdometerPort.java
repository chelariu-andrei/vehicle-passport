package com.vehiclepassport.server.fuel.application.port.out;

import java.util.Optional;

public interface LatestOdometerPort {

    /** The highest odometer reading in the car's event history; empty when there is none. */
    Optional<Integer> latestKm(String vin);
}
