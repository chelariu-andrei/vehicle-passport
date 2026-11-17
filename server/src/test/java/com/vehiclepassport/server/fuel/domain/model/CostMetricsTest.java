package com.vehiclepassport.server.fuel.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CostMetricsTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 17);

    private static FuelEntry entry(LocalDate date, int km, String quantity, String total) {
        return new FuelEntry(UUID.randomUUID(), "WVWZZZ1JZXW000001", UUID.randomUUID(), UUID.randomUUID(), date, km,
                FuelEntryType.DIESEL, new BigDecimal(quantity), new BigDecimal(total), null, "RON", null, null, null,
                null, true, false, Instant.parse("2026-11-17T10:00:00Z").plusSeconds(km));
    }

    @Test
    void cost_per_km_excludes_the_first_entry_cost() {
        List<FuelEntry> e = List.of(entry(LocalDate.of(2026, 10, 1), 10000, "40", "300.00"),
                entry(LocalDate.of(2026, 10, 20), 10600, "42", "315.00"));

        // 315.00 / 600
        assertEquals(new BigDecimal("0.5250"), CostMetrics.costPerKm(e));
    }

    @Test
    void cost_per_km_null_with_one_entry() {
        assertNull(CostMetrics.costPerKm(List.of(entry(LocalDate.of(2026, 10, 1), 10000, "40", "300.00"))));
        assertNull(CostMetrics.costPerKm(List.of()));
    }

    @Test
    void cost_per_km_null_with_zero_span() {
        assertNull(CostMetrics.costPerKm(List.of(entry(LocalDate.of(2026, 10, 1), 10000, "40", "300.00"),
                entry(LocalDate.of(2026, 10, 1), 10000, "5", "40.00"))));
    }

    @Test
    void avg_unit_price_is_total_over_quantity() {
        List<FuelEntry> e = List.of(entry(LocalDate.of(2026, 10, 1), 10000, "40", "300.00"),
                entry(LocalDate.of(2026, 10, 20), 10600, "38.2", "312.00"));

        // 612.00 / 78.2
        assertEquals(new BigDecimal("7.8261"), CostMetrics.avgUnitPrice(e));
        assertNull(CostMetrics.avgUnitPrice(List.of()));
    }

    @Test
    void month_estimate_null_with_two_entries_in_60_days() {
        List<FuelEntry> e = List.of(entry(LocalDate.of(2026, 8, 1), 9000, "40", "1000.00"),
                entry(LocalDate.of(2026, 10, 20), 10000, "40", "300.00"),
                entry(LocalDate.of(2026, 11, 10), 10600, "38", "285.00"));

        MonthEstimate m = CostMetrics.monthEstimate(e, TODAY);

        assertEquals(YearMonth.of(2026, 11), m.month());
        assertEquals(new BigDecimal("285.00"), m.spentSoFar());
        assertNull(m.projected());
    }

    @Test
    void month_estimate_projects_last_60_days_over_the_current_month() {
        // window starts 2026-09-19; the August entry is outside it
        List<FuelEntry> e = List.of(entry(LocalDate.of(2026, 8, 1), 9000, "40", "1000.00"),
                entry(LocalDate.of(2026, 9, 25), 9600, "40", "300.00"),
                entry(LocalDate.of(2026, 10, 20), 10000, "42", "315.00"),
                entry(LocalDate.of(2026, 11, 10), 10600, "38", "285.00"));

        MonthEstimate m = CostMetrics.monthEstimate(e, TODAY);

        // (300 + 315 + 285) / 60 * 30 days in November
        assertEquals(new BigDecimal("450.00"), m.projected());
        assertEquals(new BigDecimal("285.00"), m.spentSoFar());
    }

    @Test
    void month_estimate_with_no_entries() {
        MonthEstimate m = CostMetrics.monthEstimate(List.of(), TODAY);

        assertEquals(new BigDecimal("0.00"), m.spentSoFar());
        assertNull(m.projected());
    }

    @Test
    void monthly_distance_uses_previous_month_last_entry_as_anchor() {
        List<FuelEntry> e = List.of(entry(LocalDate.of(2026, 11, 12), 10900, "20", "150.00"),
                entry(LocalDate.of(2026, 10, 3), 10000, "40", "300.00"),
                entry(LocalDate.of(2026, 10, 25), 10300, "20", "160.00"),
                entry(LocalDate.of(2026, 11, 2), 10600, "42", "315.00"));

        List<MonthCost> m = CostMetrics.monthly(e);

        assertEquals(2, m.size());
        MonthCost oct = m.get(0);
        assertEquals(YearMonth.of(2026, 10), oct.month());
        assertEquals(new BigDecimal("460.00"), oct.cost());
        assertEquals(0, new BigDecimal("60").compareTo(oct.quantity()));
        assertEquals(2, oct.entries());
        assertNull(oct.distanceKm()); // no September entry to anchor on
        MonthCost nov = m.get(1);
        assertEquals(YearMonth.of(2026, 11), nov.month());
        assertEquals(new BigDecimal("465.00"), nov.cost());
        assertEquals(2, nov.entries());
        assertEquals(600, nov.distanceKm()); // 10900 - 10300 (last October entry)
    }

    @Test
    void monthly_distance_null_when_previous_month_is_empty() {
        List<FuelEntry> e = List.of(entry(LocalDate.of(2026, 9, 3), 9000, "40", "300.00"),
                entry(LocalDate.of(2026, 11, 2), 10600, "42", "315.00"),
                entry(LocalDate.of(2026, 11, 12), 10900, "20", "150.00"));

        List<MonthCost> m = CostMetrics.monthly(e);

        assertEquals(2, m.size());
        assertNull(m.get(1).distanceKm());
    }
}
