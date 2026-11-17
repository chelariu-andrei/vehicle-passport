package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;

/** Both optional. The station is trimmed to at most 100 chars; blank means none. */
public record ItpDetails(String station, ItpResult result) implements EventDetails {

    private static final int MAX_STATION = 100;

    public ItpDetails {
        station = station == null || station.isBlank() ? null : station.trim();
        if (station != null && station.length() > MAX_STATION) {
            throw new InvalidEventException("ITP station must be at most " + MAX_STATION + " characters");
        }
    }

    @Override
    public DetailsKind kind() {
        return DetailsKind.ITP;
    }
}