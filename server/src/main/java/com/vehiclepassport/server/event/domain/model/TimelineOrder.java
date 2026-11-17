package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import java.util.Locale;

/** Direction of the timeline over (date, createdAt, id). Ascending when the client sends none. */
public enum TimelineOrder {
    ASC, DESC;

    public static TimelineOrder parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return ASC;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new InvalidEventException("Unknown timeline order: " + raw);
        }
    }
}
