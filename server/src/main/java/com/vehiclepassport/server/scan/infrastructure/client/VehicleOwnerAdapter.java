package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.scan.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

@ApplicationScoped
public class VehicleOwnerAdapter implements ActiveOwnerPort {

    private final AssertActiveOwnerUseCase vehicles;

    @Inject
    public VehicleOwnerAdapter(AssertActiveOwnerUseCase vehicles) {
        this.vehicles = vehicles;
    }

    @Override
    public UUID assertActiveOwner(String vin, UUID userId) {
        return vehicles.assertActiveOwner(vin, userId).periodId();
    }

    @Override
    public boolean isPeriodOpen(UUID periodId) {
        return vehicles.isPeriodOpen(periodId);
    }
}
