package com.vehiclepassport.server.fuel.application.port.in;

public interface AddFuelEntryUseCase {

    FuelEntryView add(FuelEntryCommand command);
}
