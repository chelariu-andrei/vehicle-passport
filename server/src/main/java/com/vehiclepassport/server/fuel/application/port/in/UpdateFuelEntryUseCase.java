package com.vehiclepassport.server.fuel.application.port.in;

public interface UpdateFuelEntryUseCase {

    /** Full replace of {@code command.entryId()}. */
    FuelEntryView update(FuelEntryCommand command);
}
