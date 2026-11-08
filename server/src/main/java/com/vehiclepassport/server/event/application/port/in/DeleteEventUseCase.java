package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface DeleteEventUseCase {

    void delete(UUID userId, String vin, UUID eventId);
}
