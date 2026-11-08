package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface ReleaseVehicleUseCase {

    void release(String vin, UUID userId);
}
