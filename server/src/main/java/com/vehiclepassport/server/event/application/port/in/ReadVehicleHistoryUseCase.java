package com.vehiclepassport.server.event.application.port.in;

import java.util.List;

/** Performs no authorisation; callers must have done it. */
public interface ReadVehicleHistoryUseCase {

    List<EventView> history(String vin);
}
