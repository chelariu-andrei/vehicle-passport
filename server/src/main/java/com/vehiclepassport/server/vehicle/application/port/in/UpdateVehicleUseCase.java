package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface UpdateVehicleUseCase {

    VehicleView update(UpdateVehicleCommand command);

    /**
     * make..fuel are the full new values. {@code plateGiven} false keeps the stored plate; true sets {@code plate},
     * where null clears it. {@code appearance} null keeps the stored look; otherwise it replaces it as a whole.
     */
    record UpdateVehicleCommand(
            UUID userId, String vin, String make, String model, String engine, int year, String fuel,
            boolean plateGiven, String plate, AppearanceView appearance) {
    }
}
