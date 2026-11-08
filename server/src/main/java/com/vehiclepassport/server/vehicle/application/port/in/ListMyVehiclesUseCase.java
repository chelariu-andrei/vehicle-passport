package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.List;
import java.util.UUID;

public interface ListMyVehiclesUseCase {

    List<VehicleView> list(UUID userId);
}
