package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface SaveConfirmedEventUseCase {

    UUID save(SaveConfirmedEventCommand command);
}
