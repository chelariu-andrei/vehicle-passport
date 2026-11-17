package com.vehiclepassport.server.fuel.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ConsumptionAlertTest {

    private static final int WINDOW = 5;
    private static final int MIN_BASELINE = 3;
    private static final BigDecimal THRESHOLD = new BigDecimal("15");

    private static List<ConsumptionSegment> segments(String... per100km) {
        List<ConsumptionSegment> out = new ArrayList<>();
        LocalDate date = LocalDate.of(2026, 1, 1);
        int km = 10_000;
        for (String v : per100km) {
            date = date.plusDays(10);
            km += 500;
            BigDecimal value = new BigDecimal(v);
            out.add(new ConsumptionSegment(UUID.randomUUID(), date, km, value.multiply(new BigDecimal("5")), 500,
                    value, null));
        }
        return out;
    }

    private static Optional<ConsumptionAlert> detect(List<ConsumptionSegment> s) {
        return ConsumptionAlert.detect(s, WINDOW, MIN_BASELINE, THRESHOLD);
    }

    @Test
    void fires_on_a_sudden_increase() {
        List<ConsumptionSegment> s = segments("6.8", "6.8", "6.8", "8.4");

        ConsumptionAlert alert = detect(s).orElseThrow();

        assertEquals(new BigDecimal("8.40"), alert.latest());
        assertEquals(new BigDecimal("6.80"), alert.baseline());
        assertEquals(new BigDecimal("23.5"), alert.deltaPct());
        assertEquals(s.get(3).closingEntryId(), alert.entryId());
    }

    @Test
    void does_not_fire_with_two_baseline_segments() {
        assertTrue(detect(segments("6.8", "6.8", "8.4")).isEmpty());
    }

    @Test
    void does_not_fire_without_segments_or_with_one() {
        assertTrue(detect(List.of()).isEmpty());
        assertTrue(detect(segments("8.4")).isEmpty());
    }

    @Test
    void does_not_fire_at_exactly_15_percent() {
        assertTrue(detect(segments("6.00", "6.00", "6.00", "6.90")).isEmpty());
    }

    @Test
    void fires_just_above_15_percent() {
        ConsumptionAlert alert = detect(segments("6.00", "6.00", "6.00", "6.91")).orElseThrow();

        assertEquals(new BigDecimal("15.2"), alert.deltaPct());
    }

    @Test
    void ignores_a_decrease() {
        assertTrue(detect(segments("6.8", "6.8", "6.8", "5.0")).isEmpty());
    }

    @Test
    void uses_only_the_last_5_baseline_segments() {
        // with all six earlier segments the mean would be 8.33 and 7.0 would not be an increase
        ConsumptionAlert alert = detect(segments("20.0", "6.0", "6.0", "6.0", "6.0", "6.0", "7.0")).orElseThrow();

        assertEquals(new BigDecimal("6.00"), alert.baseline());
        assertEquals(new BigDecimal("16.7"), alert.deltaPct());
    }
}
