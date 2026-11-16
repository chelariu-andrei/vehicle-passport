package com.vehiclepassport.server.event.application.port.in;

import java.util.UUID;

public interface CountOwnedByOwnerUseCase {

    long count(UUID ownerId);
}
