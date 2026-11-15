package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface CountOwnedByOwnerUseCase {

    long count(UUID ownerId);
}
