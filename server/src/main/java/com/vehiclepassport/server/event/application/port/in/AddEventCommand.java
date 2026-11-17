package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public record AddEventCommand(UUID userId, String vin, EventInput input) {
}
