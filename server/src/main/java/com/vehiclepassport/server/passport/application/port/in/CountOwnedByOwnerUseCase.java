package com.vehiclepassport.server.passport.application.port.in;

import java.util.UUID;

public interface CountOwnedByOwnerUseCase {

    long count(UUID ownerId);
}
