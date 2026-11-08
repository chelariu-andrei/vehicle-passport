package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface GetVehicleUseCase {

    VehicleView get(String vin, UUID userId);
}
