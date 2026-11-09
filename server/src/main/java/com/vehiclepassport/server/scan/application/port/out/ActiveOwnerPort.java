package com.vehiclepassport.server.scan.application.port.out;

import java.util.UUID;

public interface ActiveOwnerPort {

    /** Returns the open ownership period of the user, or throws when the user is not the active owner. */
    UUID assertActiveOwner(String vin, UUID userId);

    boolean isPeriodOpen(UUID periodId);
}
