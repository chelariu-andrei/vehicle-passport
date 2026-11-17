package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.domain.exception.InvalidCursorException;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TimelineCursorTest {

    @Test
    void round_trip() {
        TimelineCursor c = new TimelineCursor(TimelineOrder.ASC, LocalDate.parse("2025-03-01"),
                Instant.parse("2026-01-15T10:00:00.123456789Z"), UUID.randomUUID());
        assertEquals(c, TimelineCursor.decode(c.encode(), TimelineOrder.ASC));
    }

    @Test
    void roundTripDesc() {
        TimelineCursor c = new TimelineCursor(TimelineOrder.DESC, LocalDate.parse("2025-03-01"),
                Instant.parse("2026-01-15T10:00:00Z"), UUID.randomUUID());
        assertEquals(c, TimelineCursor.decode(c.encode(), TimelineOrder.DESC));
    }

    @Test
    void cursor_used_with_other_order_is_invalid() {
        String asc = new TimelineCursor(TimelineOrder.ASC, LocalDate.parse("2025-03-01"),
                Instant.parse("2026-01-15T10:00:00Z"), UUID.randomUUID()).encode();
        InvalidCursorException e = assertThrows(InvalidCursorException.class,
                () -> TimelineCursor.decode(asc, TimelineOrder.DESC));
        assertEquals("invalid-cursor", e.code());
    }

    /** A cursor issued before the order existed (3 parts) keeps paging ascending after the deploy. */
    @Test
    void legacyCursorDecodesAsAsc() {
        UUID id = UUID.randomUUID();
        String legacy = Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("2025-01-01|2025-01-01T10:00:00Z|" + id).getBytes(StandardCharsets.UTF_8));
        assertEquals(new TimelineCursor(TimelineOrder.ASC, LocalDate.parse("2025-01-01"),
                Instant.parse("2025-01-01T10:00:00Z"), id), TimelineCursor.decode(legacy, TimelineOrder.ASC));
        assertThrows(InvalidCursorException.class, () -> TimelineCursor.decode(legacy, TimelineOrder.DESC));
    }

    @Test
    void garbage_throws_invalid_cursor() {
        String unknownOrder = Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("SIDEWAYS|2025-01-01|2025-01-01T10:00:00Z|" + UUID.randomUUID()).getBytes(StandardCharsets.UTF_8));
        for (String bad : new String[] {"", "!!!", "bm90LWEtY3Vyc29y", "YXxifGM", unknownOrder}) {
            InvalidCursorException e = assertThrows(InvalidCursorException.class,
                    () -> TimelineCursor.decode(bad, TimelineOrder.ASC));
            assertEquals("invalid-cursor", e.code());
        }
        assertThrows(InvalidCursorException.class, () -> TimelineCursor.decode(null, TimelineOrder.ASC));
    }

    @Test
    void order_parse_defaults_to_asc_and_ignores_case() {
        assertEquals(TimelineOrder.ASC, TimelineOrder.parse(null));
        assertEquals(TimelineOrder.ASC, TimelineOrder.parse(" "));
        assertEquals(TimelineOrder.DESC, TimelineOrder.parse("desc"));
        assertEquals(TimelineOrder.ASC, TimelineOrder.parse("ASC"));
    }
}
