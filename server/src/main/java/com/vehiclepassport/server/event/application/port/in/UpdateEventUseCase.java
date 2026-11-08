package com.vehiclepassport.server.event.application.port.in;

public interface UpdateEventUseCase {

    EventView update(UpdateEventCommand command);
}
