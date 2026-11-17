package com.vehiclepassport.server.fuel.infrastructure.client;

import com.vehiclepassport.server.fuel.application.port.out.VehicleFuelPort;
import com.vehiclepassport.server.fuel.domain.model.VehicleFuel;
import com.vehiclepassport.server.vehicle.application.port.in.GetVehicleUseCase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Reads the vehicle's fuel through {@code vehicle}'s existing {@link GetVehicleUseCase} (owner-checked). */
@ApplicationScoped
public class VehicleFeatureAdapter implements VehicleFuelPort {

    private final GetVehicleUseCase vehicles;

    @Inject
    public VehicleFeatureAdapter(GetVehicleUseCase vehicles) {
        this.vehicles = vehicles;
    }

    /** Both enums carry the same names; an unknown future value is treated as OTHER (accepts any fuel). */
    @Override
    public VehicleFuel fuelOf(String vin, UUID userId) {
        String fuel = vehicles.get(vin, userId).fuel();
        for (VehicleFuel f : VehicleFuel.values()) {
            if (f.name().equals(fuel)) {
                return f;
            }
        }
        return VehicleFuel.OTHER;
    }
}
