package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface UpdateVehicleUseCase {

    VehicleView update(UpdateVehicleCommand command);

    record UpdateVehicleCommand(
            UUID userId, String vin, String make, String model, String engine, int year, String fuel) {
    }
}
