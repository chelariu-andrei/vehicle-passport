package com.vehiclepassport.server.fuel.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GradeComparisonTest {

    private static ConsumptionSegment seg(FuelGrade grade, String quantity, int km) {
        BigDecimal q = new BigDecimal(quantity);
        return new ConsumptionSegment(UUID.randomUUID(), LocalDate.of(2026, 10, 1), 10_000, q, km,
                q.multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(km), 2, java.math.RoundingMode.HALF_UP),
                grade);
    }

    private static List<ConsumptionSegment> of(int standard, int premium) {
        List<ConsumptionSegment> out = new ArrayList<>();
        for (int i = 0; i < standard; i++) {
            out.add(seg(FuelGrade.STANDARD, "42", 600));
        }
        for (int i = 0; i < premium; i++) {
            out.add(seg(FuelGrade.PREMIUM, "39", 600));
        }
        out.add(seg(null, "50", 500)); // mixed / untagged: never counted
        return out;
    }

    @Test
    void hidden_with_two_and_three_segments() {
        assertTrue(GradeComparison.compare(of(2, 3), 3).isEmpty());
        assertTrue(GradeComparison.compare(of(3, 2), 3).isEmpty());
    }

    @Test
    void shown_with_three_and_three_segments() {
        List<GradeComparison> r = GradeComparison.compare(of(3, 3), 3);

        assertEquals(List.of(new GradeComparison(FuelGrade.STANDARD, new BigDecimal("7.00"), 3),
                new GradeComparison(FuelGrade.PREMIUM, new BigDecimal("6.50"), 3)), r);
    }

    @Test
    void grade_average_is_weighted() {
        List<ConsumptionSegment> s = new ArrayList<>(of(2, 3));
        s.add(seg(FuelGrade.STANDARD, "8", 100)); // 8.0 over 100 km next to 7.0 over 1200 km

        List<GradeComparison> r = GradeComparison.compare(s, 3);

        // (84 + 8) / 1300 * 100 = 7.0769...
        assertEquals(new BigDecimal("7.08"), r.get(0).average());
        assertEquals(3, r.get(0).segmentCount());
    }
}
