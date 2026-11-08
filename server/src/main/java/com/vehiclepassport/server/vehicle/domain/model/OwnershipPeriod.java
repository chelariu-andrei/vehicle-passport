package com.vehiclepassport.server.vehicle.domain.model;

import java.time.Instant;
import java.util.UUID;

public record OwnershipPeriod(UUID id, Vin vin, UUID ownerId, Instant from, Instant to) {

    public boolean isOpen() {
        return to == null;
    }

    public OwnershipPeriod close(Instant at) {
        if (!isOpen()) {
            throw new IllegalStateException("ownership period " + id + " is already closed");
        }
        return new OwnershipPeriod(id, vin, ownerId, from, at);
    }
}
