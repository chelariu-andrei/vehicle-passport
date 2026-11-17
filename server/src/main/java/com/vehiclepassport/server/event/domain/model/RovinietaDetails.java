package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;

/** The duration decides the end of validity; the vehicle category is not stored. */
public record RovinietaDetails(RovinietaDuration duration) implements EventDetails {

    public RovinietaDetails {
        if (duration == null) {
            throw new InvalidEventException("Rovinieta duration is required");
        }
    }

    @Override
    public DetailsKind kind() {
        return DetailsKind.ROVINIETA;
    }
}