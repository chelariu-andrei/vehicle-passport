package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface GetEventDocumentUseCase {

    EventDocument get(UUID userId, String vin, UUID eventId);
}
