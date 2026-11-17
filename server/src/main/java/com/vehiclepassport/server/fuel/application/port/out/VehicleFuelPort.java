package com.vehiclepassport.server.fuel.application.port.out;

import com.vehiclepassport.server.fuel.domain.model.VehicleFuel;
import java.util.UUID;

public interface VehicleFuelPort {

    /** The fuel of the vehicle, read as its active owner. */
    VehicleFuel fuelOf(String vin, UUID userId);
}
