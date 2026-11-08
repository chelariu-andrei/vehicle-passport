package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.event.domain.exception.DocumentedEventImmutableException;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VehicleEventTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"), ZoneOffset.UTC);
    private static final UUID USER = UUID.randomUUID();
    private static final UUID PERIOD = UUID.randomUUID();

    private static VehicleEvent manual(LocalDate date, int km, BigDecimal cost, String currency) {
        return VehicleEvent.manual("WVWZZZ1JZXW000001", EventType.SERVICE, date, km, cost, currency, "n",
                USER, PERIOD, CLOCK);
    }

    @Test
    void manual_is_user_confirmed() {
        VehicleEvent e = manual(LocalDate.parse("2025-03-01"), 120000, new BigDecimal("450"), "RON");
        assertEquals(EvidenceLevel.USER_CONFIRMED, e.evidence());
        assertEquals(EventSource.MANUAL, e.source());
        assertEquals(USER, e.createdBy());
        assertEquals(PERIOD, e.periodId());
        assertEquals(Instant.parse("2026-01-15T10:00:00Z"), e.createdAt());
        assertNull(e.deletedAt());
        assertNull(e.details());
        assertNull(e.documentKey());
    }

    @Test
    void today_is_accepted() {
        manual(LocalDate.parse("2026-01-15"), 0, BigDecimal.ZERO, "RON");
    }

    @Test
    void future_date_rejected() {
        InvalidEventException e = assertThrows(InvalidEventException.class,
                () -> manual(LocalDate.parse("2026-01-16"), 1000, BigDecimal.TEN, "RON"));
        assertEquals("invalid-event", e.code());
    }

    @Test
    void negative_km_rejected() {
        assertThrows(InvalidEventException.class,
                () -> manual(LocalDate.parse("2025-03-01"), -1, BigDecimal.TEN, "RON"));
    }

    @Test
    void negative_cost_rejected() {
        assertThrows(InvalidEventException.class,
                () -> manual(LocalDate.parse("2025-03-01"), 1000, new BigDecimal("-1"), "RON"));
    }

    @Test
    void null_cost_rejected() {
        InvalidEventException e = assertThrows(InvalidEventException.class,
                () -> manual(LocalDate.parse("2025-03-01"), 1000, null, "RON"));
        assertEquals("invalid-event", e.code());
    }

    @Test
    void null_currency_rejected_even_with_cost() {
        assertThrows(InvalidEventException.class,
                () -> manual(LocalDate.parse("2025-03-01"), 1000, BigDecimal.TEN, null));
    }

    @Test
    void currency_must_be_three_letters() {
        for (String bad : new String[] {"RO", "RONN", "R0N", "", null}) {
            assertThrows(InvalidEventException.class,
                    () -> manual(LocalDate.parse("2025-03-01"), 1000, BigDecimal.TEN, bad), String.valueOf(bad));
        }
    }

    private static VehicleEvent documented(int km) {
        return VehicleEvent.documented("WVWZZZ1JZXW000001", EventType.SERVICE, LocalDate.parse("2025-03-01"), km,
                new BigDecimal("450.00"), "RON", "n", null, "doc-key", USER, PERIOD, CLOCK);
    }

    @Test
    void documented_event_is_scan_sourced() {
        VehicleEvent e = documented(120000);
        assertEquals(EvidenceLevel.DOCUMENTED, e.evidence());
        assertEquals(EventSource.SCAN, e.source());
        assertEquals("doc-key", e.documentKey());
    }

    @Test
    void editing_keeps_evidence_level() {
        VehicleEvent e = manual(LocalDate.parse("2025-03-01"), 120000, new BigDecimal("450"), "RON");
        VehicleEvent edited = e.edited(EventType.REPAIR, LocalDate.parse("2025-03-02"), 121000, BigDecimal.TEN,
                "eur", "x", Clock.fixed(Instant.parse("2026-02-01T00:00:00Z"), ZoneOffset.UTC));
        assertEquals(EvidenceLevel.USER_CONFIRMED, edited.evidence());
        assertEquals(e.id(), edited.id());
        assertEquals(e.createdAt(), edited.createdAt());
        assertEquals("EUR", edited.currency());
        assertEquals(121000, edited.odometerKm());
    }

    @Test
    void documented_rejects_km_change() {
        VehicleEvent e = documented(120000);
        DocumentedEventImmutableException ex = assertThrows(DocumentedEventImmutableException.class,
                () -> e.edited(e.type(), e.date(), 121000, e.costAmount(), e.currency(), e.notes(), CLOCK));
        assertEquals("documented-event-immutable", ex.code());
    }

    @Test
    void documented_accepts_notes_change() {
        VehicleEvent e = documented(120000);
        VehicleEvent edited = e.edited(e.type(), e.date(), 120000, new BigDecimal("450"), "ron", "new", CLOCK);
        assertEquals("new", edited.notes());
        assertEquals(EvidenceLevel.DOCUMENTED, edited.evidence());
        assertEquals(new BigDecimal("450.00"), edited.costAmount());
    }
}
