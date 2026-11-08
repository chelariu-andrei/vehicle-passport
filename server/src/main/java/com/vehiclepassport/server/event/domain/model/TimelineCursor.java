package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidCursorException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;

public record TimelineCursor(LocalDate date, Instant createdAt, UUID id) {

    public String encode() {
        String raw = date + "|" + createdAt + "|" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static TimelineCursor decode(String cursor) {
        if (cursor == null || cursor.isEmpty()) {
            throw new InvalidCursorException("Cursor is malformed");
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = raw.split("[|]", -1);
            if (parts.length != 3) {
                throw new InvalidCursorException("Cursor is malformed");
            }
            return new TimelineCursor(LocalDate.parse(parts[0]), Instant.parse(parts[1]), UUID.fromString(parts[2]));
        } catch (IllegalArgumentException | java.time.DateTimeException e) {
            throw new InvalidCursorException("Cursor is malformed");
        }
    }
}
