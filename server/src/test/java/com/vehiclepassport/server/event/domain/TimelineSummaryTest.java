package com.vehiclepassport.server.event.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.TimelineSummary;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TimelineSummaryTest {

    @Test
    void distanceNeedsBothReadings() {
        assertEquals(12000, new TimelineSummary(0, null, null, 90000, 102000, null).distanceKm());
        assertNull(new TimelineSummary(0, null, null, null, 102000, null).distanceKm());
        assertNull(new TimelineSummary(0, null, null, 90000, null, null).distanceKm());
    }

    @Test
    void valuesAreCanonical() {
        TimelineSummary s = new TimelineSummary(3,
                Map.of(EventType.REPAIR, 1L, EventType.SERVICE, 2L, EventType.ITP, 0L),
                Map.of("EUR", new BigDecimal("40"), "RON", new BigDecimal("350.5"), "USD", new BigDecimal("40.0")),
                null, null, List.of(2023, 2025, 2023));

        assertEquals(List.of(EventType.SERVICE, EventType.REPAIR), List.copyOf(s.countsByType().keySet()),
                "zero counts dropped, declaration order");
        assertEquals(List.of(Map.entry("RON", new BigDecimal("350.50")), Map.entry("EUR", new BigDecimal("40.00")),
                Map.entry("USD", new BigDecimal("40.00"))), List.copyOf(s.costByCurrency().entrySet()),
                "two decimals, amount descending, then currency");
        assertEquals(List.of(2025, 2023), s.years());
    }
}
