package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface AssertActiveOwnerUseCase {

    ActiveOwnership assertActiveOwner(String vin, UUID userId);

    boolean isPeriodOpen(UUID periodId);
}
