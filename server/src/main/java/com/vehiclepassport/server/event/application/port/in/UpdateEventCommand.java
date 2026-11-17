package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public record UpdateEventCommand(UUID userId, String vin, UUID eventId, EventInput input) {
}
