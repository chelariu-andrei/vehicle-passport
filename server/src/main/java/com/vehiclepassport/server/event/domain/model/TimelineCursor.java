package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidCursorException;
import java.nio.charset.StandardCharsets;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;

/**
 * Position after which the next page starts, bound to the order it was issued for. Encoded as base64url of
 * {@code ORDER|date|createdAt|id}. A cursor issued before the order existed ({@code date|createdAt|id}) is ascending.
 */
public record TimelineCursor(TimelineOrder order, LocalDate date, Instant createdAt, UUID id) {

    public String encode() {
        String raw = order + "|" + date + "|" + createdAt + "|" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static TimelineCursor decode(String cursor, TimelineOrder expected) {
        if (cursor == null || cursor.isEmpty()) {
            throw new InvalidCursorException("Cursor is malformed");
        }
        TimelineCursor decoded;
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            String[] parts = raw.split("[|]", -1);
            if (parts.length == 3) {
                decoded = new TimelineCursor(TimelineOrder.ASC, LocalDate.parse(parts[0]), Instant.parse(parts[1]),
                        UUID.fromString(parts[2]));
            } else if (parts.length == 4) {
                decoded = new TimelineCursor(TimelineOrder.valueOf(parts[0]), LocalDate.parse(parts[1]),
                        Instant.parse(parts[2]), UUID.fromString(parts[3]));
            } else {
                throw new InvalidCursorException("Cursor is malformed");
            }
        } catch (IllegalArgumentException | DateTimeException e) {
            throw new InvalidCursorException("Cursor is malformed");
        }
        if (decoded.order() != expected) {
            throw new InvalidCursorException("Cursor was issued for a different order");
        }
        return decoded;
    }
}