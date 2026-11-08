package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.domain.exception.InvalidCursorException;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TimelineCursorTest {

    @Test
    void round_trip() {
        TimelineCursor c = new TimelineCursor(LocalDate.parse("2025-03-01"),
                Instant.parse("2026-01-15T10:00:00.123456789Z"), UUID.randomUUID());
        assertEquals(c, TimelineCursor.decode(c.encode()));
    }

    @Test
    void garbage_throws_invalid_cursor() {
        for (String bad : new String[] {"", "!!!", "bm90LWEtY3Vyc29y", "YXxifGM"}) {
            InvalidCursorException e = assertThrows(InvalidCursorException.class, () -> TimelineCursor.decode(bad));
            assertEquals("invalid-cursor", e.code());
        }
        assertThrows(InvalidCursorException.class, () -> TimelineCursor.decode(null));
    }
}
