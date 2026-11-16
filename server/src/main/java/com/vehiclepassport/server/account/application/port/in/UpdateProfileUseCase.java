package com.vehiclepassport.server.account.application.port.in;

import java.util.UUID;

public interface UpdateProfileUseCase {

    /** The returned {@link Me} has {@code emailVerified} false; the caller overlays the token value. */
    Me update(UUID userId, ProfileChange change);
}
