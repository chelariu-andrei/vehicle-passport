package com.vehiclepassport.server.event.application.port.in;

public interface AddEventUseCase {

    EventView add(AddEventCommand command);
}
