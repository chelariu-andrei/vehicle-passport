package com.vehiclepassport.server.fuel.application.port.in;

import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
import com.vehiclepassport.server.fuel.domain.model.FuelUnit;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * Mirrors {@code FuelStatsResponse}. Money figures, entry counts and points use only the entries of
 * {@code currency}; {@code ignoredEntries} counts the period's entries in other currencies.
 */
public record FuelStatsView(String currency, Period period, Integer lastOdometerKm, int entryCount,
        int ignoredEntries, BigDecimal totalCost, BigDecimal costPerKm, List<MonthCost> monthly,
        MonthEstimate monthEstimate, List<FuelTypeStats> byFuelType) {

    /** {@code from} is null for {@code all}. */
    public record Period(LocalDate from, LocalDate to) {
    }

    public record MonthCost(YearMonth month, BigDecimal cost, BigDecimal quantity, int entries,
            Integer distanceKm) {
    }

    public record MonthEstimate(YearMonth month, BigDecimal spentSoFar, BigDecimal projected) {
    }

    public record FuelTypeStats(FuelEntryType fuelType, FuelUnit unit, BigDecimal avgConsumption,
            BigDecimal lastConsumption, BigDecimal avgUnitPrice, int segmentCount, List<Point> points, Alert alert,
            List<GradeStats> gradeComparison) {
    }

    /** {@code consumption} is set on the full fill-up that closes an included segment. */
    public record Point(UUID entryId, LocalDate date, int odometerKm, BigDecimal unitPrice,
            BigDecimal consumption) {
    }

    public record Alert(BigDecimal latest, BigDecimal baseline, BigDecimal deltaPct, UUID entryId) {
    }

    public record GradeStats(FuelGrade grade, BigDecimal avgConsumption, int segmentCount) {
    }
}
