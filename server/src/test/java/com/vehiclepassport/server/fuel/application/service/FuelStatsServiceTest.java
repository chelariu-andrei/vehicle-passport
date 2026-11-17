package com.vehiclepassport.server.fuel.application.service;

import static com.vehiclepassport.server.fuel.application.service.FuelFakes.VIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.fuel.application.FuelConfig;
import com.vehiclepassport.server.fuel.application.port.in.FuelStatsView;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelUnit;
import com.vehiclepassport.server.shared.error.DomainException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FuelStatsServiceTest {

    private static final FuelConfig CONFIG = () -> new FuelConfig.Alert() {
        public BigDecimal thresholdPct() {
            return new BigDecimal("15");
        }

        public int window() {
            return 5;
        }

        public int minBaseline() {
            return 3;
        }
    };

    private FuelFakes.Repo repo;
    private FuelFakes.Odometer odometer;
    private FuelStatsService service;
    private UUID owner;
    private UUID period;
    private int seq;

    @BeforeEach
    void setUp() {
        repo = new FuelFakes.Repo();
        FuelFakes.Owners owners = new FuelFakes.Owners();
        odometer = new FuelFakes.Odometer();
        service = new FuelStatsService(repo, owners, odometer, new FuelFakes.FixedClock(), CONFIG);
        owner = UUID.randomUUID();
        period = owners.own(owner);
    }

    private FuelEntry put(FuelEntryType type, String date, int km, String quantity, String total, String currency) {
        BigDecimal q = new BigDecimal(quantity);
        BigDecimal t = new BigDecimal(total);
        FuelEntry e = new FuelEntry(UUID.randomUUID(), VIN, period, owner, LocalDate.parse(date), km, type, q, t,
                t.divide(q, 4, RoundingMode.HALF_UP), currency, null, null, null, null, true, false,
                Instant.parse("2026-01-01T00:00:00Z").plusSeconds(seq++));
        return repo.save(e);
    }

    private FuelEntry diesel(String date, int km, String quantity, String total) {
        return put(FuelEntryType.DIESEL, date, km, quantity, total, "RON");
    }

    @Test
    void empty_car_returns_empty_structures_and_nulls() {
        FuelStatsView s = service.stats(owner, VIN, "6m");
        assertNull(s.currency());
        assertNull(s.lastOdometerKm());
        assertEquals(0, s.entryCount());
        assertEquals(0, s.ignoredEntries());
        assertEquals(0, s.totalCost().signum());
        assertNull(s.costPerKm());
        assertTrue(s.monthly().isEmpty());
        assertTrue(s.byFuelType().isEmpty());
        assertEquals("2026-11", s.monthEstimate().month().toString());
        assertEquals(0, s.monthEstimate().spentSoFar().signum());
        assertNull(s.monthEstimate().projected());
        assertEquals(LocalDate.of(2026, 5, 17), s.period().from());
        assertEquals(LocalDate.of(2026, 11, 17), s.period().to());
    }

    @Test
    void single_entry_has_no_consumption_and_no_cost_per_km() {
        FuelEntry only = diesel("2026-11-01", 10000, "40.0", "300.00");
        FuelStatsView s = service.stats(owner, VIN, "6m");
        assertEquals("RON", s.currency());
        assertEquals(1, s.entryCount());
        assertNull(s.costPerKm());
        assertEquals(10000, s.lastOdometerKm());
        FuelStatsView.FuelTypeStats d = s.byFuelType().get(0);
        assertEquals(FuelEntryType.DIESEL, d.fuelType());
        assertNull(d.avgConsumption());
        assertNull(d.lastConsumption());
        assertNull(d.alert());
        assertEquals(0, d.segmentCount());
        assertEquals(new BigDecimal("7.5000"), d.avgUnitPrice());
        assertEquals(1, d.points().size());
        assertEquals(only.id(), d.points().get(0).entryId());
        assertNull(d.points().get(0).consumption());
    }

    @Test
    void period_3m_excludes_older_entries() {
        diesel("2026-07-01", 10000, "40.0", "300.00");
        FuelEntry closing = diesel("2026-09-01", 10600, "42.0", "315.00");
        diesel("2026-10-01", 11200, "42.0", "315.00");
        FuelStatsView s = service.stats(owner, VIN, "3m");
        assertEquals(LocalDate.of(2026, 8, 17), s.period().from());
        assertEquals(2, s.entryCount());
        assertEquals(new BigDecimal("630.00"), s.totalCost());
        FuelStatsView.FuelTypeStats d = s.byFuelType().get(0);
        assertEquals(2, d.points().size());
        // The segment opened before the period still closes inside it, so it counts.
        assertEquals(2, d.segmentCount());
        assertEquals(new BigDecimal("7.00"), d.points().get(0).consumption());
        assertEquals(closing.id(), d.points().get(0).entryId());
        assertEquals(new BigDecimal("7.00"), d.avgConsumption());
    }

    @Test
    void period_all_includes_everything() {
        diesel("2024-01-01", 10000, "40.0", "300.00");
        diesel("2026-09-01", 10600, "42.0", "315.00");
        FuelStatsView s = service.stats(owner, VIN, "all");
        assertNull(s.period().from());
        assertEquals(2, s.entryCount());
        assertEquals(1, s.byFuelType().get(0).segmentCount());
        assertEquals(new BigDecimal("0.5250"), s.costPerKm());
    }

    @Test
    void last_odometer_is_max_of_events_and_fuel() {
        diesel("2025-01-01", 11200, "40.0", "300.00");
        odometer.latest = 15000;
        assertEquals(15000, service.stats(owner, VIN, "6m").lastOdometerKm());
        odometer.latest = 9000;
        // the fuel reading counts even when it is outside the selected period
        assertEquals(11200, service.stats(owner, VIN, "3m").lastOdometerKm());
        repo.rows.clear();
        assertEquals(9000, service.stats(owner, VIN, "3m").lastOdometerKm());
    }

    @Test
    void two_fuel_types_are_separate_blocks() {
        put(FuelEntryType.ELECTRIC, "2026-10-01", 10000, "30.0", "60.00", "RON");
        put(FuelEntryType.PETROL, "2026-10-02", 10100, "35.0", "250.00", "RON");
        put(FuelEntryType.ELECTRIC, "2026-10-10", 10300, "45.0", "90.00", "RON");
        FuelStatsView s = service.stats(owner, VIN, "6m");
        assertEquals(2, s.byFuelType().size());
        FuelStatsView.FuelTypeStats petrol = s.byFuelType().get(0);
        FuelStatsView.FuelTypeStats electric = s.byFuelType().get(1);
        assertEquals(FuelEntryType.PETROL, petrol.fuelType());
        assertEquals(FuelUnit.L, petrol.unit());
        assertEquals(1, petrol.points().size());
        assertEquals(FuelEntryType.ELECTRIC, electric.fuelType());
        assertEquals(FuelUnit.KWH, electric.unit());
        assertEquals(new BigDecimal("15.00"), electric.avgConsumption());
        assertEquals(3, s.entryCount());
    }

    @Test
    void mixed_currencies_use_the_most_frequent_and_count_the_rest() {
        diesel("2026-09-01", 10000, "40.0", "300.00");
        diesel("2026-09-10", 10300, "40.0", "300.00");
        put(FuelEntryType.DIESEL, "2026-09-20", 10600, "40.0", "60.00", "EUR");
        diesel("2026-10-01", 10900, "40.0", "300.00");
        FuelStatsView s = service.stats(owner, VIN, "6m");
        assertEquals("RON", s.currency());
        assertEquals(3, s.entryCount());
        assertEquals(1, s.ignoredEntries());
        assertEquals(new BigDecimal("900.00"), s.totalCost());
        assertEquals(3, s.byFuelType().get(0).points().size());
        assertEquals(new BigDecimal("7.5000"), s.byFuelType().get(0).avgUnitPrice());
    }

    @Test
    void currency_tie_goes_to_the_most_recent_entry() {
        diesel("2026-09-01", 10000, "40.0", "300.00");
        put(FuelEntryType.DIESEL, "2026-09-20", 10600, "40.0", "60.00", "EUR");
        FuelStatsView s = service.stats(owner, VIN, "6m");
        assertEquals("EUR", s.currency());
        assertEquals(1, s.ignoredEntries());
    }

    @Test
    void alert_and_grade_come_from_the_calculators() {
        diesel("2026-06-01", 10000, "40.0", "300.00");
        diesel("2026-07-01", 11000, "68.0", "500.00");
        diesel("2026-08-01", 12000, "68.0", "500.00");
        diesel("2026-09-01", 13000, "68.0", "500.00");
        diesel("2026-10-01", 14000, "68.0", "500.00");
        FuelEntry last = diesel("2026-11-01", 15000, "84.0", "600.00");
        FuelStatsView.FuelTypeStats d = service.stats(owner, VIN, "6m").byFuelType().get(0);
        assertNotNull(d.alert());
        assertEquals(new BigDecimal("8.40"), d.alert().latest());
        assertEquals(new BigDecimal("6.80"), d.alert().baseline());
        assertEquals(last.id(), d.alert().entryId());
        assertEquals(new BigDecimal("8.40"), d.lastConsumption());
        assertTrue(d.gradeComparison().isEmpty());
    }

    @Test
    void unknown_period_is_validation_failed() {
        DomainException e = assertThrows(DomainException.class, () -> service.stats(owner, VIN, "2w"));
        assertEquals("validation-failed", e.code());
        assertEquals(400, e.kind().status());
        assertEquals("validation-failed",
                assertThrows(DomainException.class, () -> service.stats(owner, VIN, null)).code());
    }

    @Test
    void non_owner_gets_vehicle_not_found() {
        assertEquals("vehicle-not-found",
                assertThrows(DomainException.class, () -> service.stats(UUID.randomUUID(), VIN, "6m")).code());
    }

    @Test
    void stats_view_lists_points_for_all_entries_chronologically() {
        diesel("2026-10-20", 10600, "42.0", "315.00");
        diesel("2026-10-01", 10000, "40.0", "300.00");
        List<FuelStatsView.Point> points = service.stats(owner, VIN, "6m").byFuelType().get(0).points();
        assertEquals(LocalDate.of(2026, 10, 1), points.get(0).date());
        assertNull(points.get(0).consumption());
        assertEquals(new BigDecimal("7.00"), points.get(1).consumption());
    }
}
