package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import java.util.Locale;

public enum EventType {
    SERVICE, REPAIR, TIRES, ITP;

    public static EventType parse(String raw) {
        if (raw == null) {
            throw new InvalidEventException("Event type is required");
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidEventException("Unknown event type: " + raw);
        }
    }
}
