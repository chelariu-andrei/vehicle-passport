package com.vehiclepassport.server.fuel.application.port.in;

import java.util.List;
import java.util.UUID;

/** Used by the data export. */
public interface ListFuelEntriesByCreatorUseCase {

    /**
     * Non-deleted fill-ups the user created, on any car and whether or not they still own it, by VIN then
     * chronologically. Never those of the car's other owners.
     */
    List<FuelEntryExportView> listByCreator(UUID userId);
}
