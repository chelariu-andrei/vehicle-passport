package com.vehiclepassport.server.event.application.port.in;

import java.util.List;
import java.util.UUID;

public interface ListEventsByCreatorUseCase {

    /** Non-deleted events the user recorded, on any car and whether or not they still own it. */
    List<CreatedEventView> listByCreator(UUID userId);

    /** An event together with the car it belongs to. */
    record CreatedEventView(String vin, EventView event) {
    }
}
