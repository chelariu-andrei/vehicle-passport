package com.vehiclepassport.server.fuel.application.port.out;

import java.util.UUID;

public interface ActiveOwnerPort {

    /** The user's open ownership period of the VIN; throws 404 {@code vehicle-not-found} for anyone else. */
    OwnedPeriod assertActiveOwner(String vin, UUID userId);
}
