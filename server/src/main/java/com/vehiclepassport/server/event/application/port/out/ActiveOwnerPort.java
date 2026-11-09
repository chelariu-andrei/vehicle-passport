package com.vehiclepassport.server.event.application.port.out;

import java.util.UUID;

public interface ActiveOwnerPort {

    /** Returns the id of the open ownership period of the user, or throws when the user is not the active owner. */
    OwnedPeriod assertActiveOwner(String vin, UUID userId);
}
