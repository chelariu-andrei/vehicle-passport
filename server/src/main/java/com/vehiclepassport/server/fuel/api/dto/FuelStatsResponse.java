package com.vehiclepassport.server.fuel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The contract's {@code FuelStatsResponse}; months are {@code YYYY-MM} text, nulls are sent as null. */
public record FuelStatsResponse(String currency, PeriodDto period, Integer lastOdometerKm, int entryCount,
        int ignoredEntries, BigDecimal totalCost, BigDecimal costPerKm, List<MonthCostDto> monthly,
        MonthEstimateDto monthEstimate, List<FuelTypeStatsDto> byFuelType) {

    /** {@code FuelStatsPeriod}; {@code from} is null for {@code all}. */
    public record PeriodDto(LocalDate from, LocalDate to) {
    }

    /** {@code FuelMonthCost}. */
    public record MonthCostDto(String month, BigDecimal cost, BigDecimal quantity, int entries, Integer distanceKm) {
    }

    /** {@code FuelMonthEstimate}. */
    public record MonthEstimateDto(String month, BigDecimal spentSoFar, BigDecimal projected) {
    }

    /** {@code FuelTypeStats}. */
    public record FuelTypeStatsDto(String fuelType, String unit, BigDecimal avgConsumption,
            BigDecimal lastConsumption, BigDecimal avgUnitPrice, int segmentCount, List<PointDto> points,
            AlertDto alert, List<GradeComparisonDto> gradeComparison) {
    }

    /** {@code FuelStatsPoint}. */
    public record PointDto(UUID entryId, LocalDate date, int odometerKm, BigDecimal unitPrice,
            BigDecimal consumption) {
    }

    /** {@code FuelConsumptionAlert}. */
    public record AlertDto(BigDecimal latest, BigDecimal baseline, BigDecimal deltaPct, UUID entryId) {
    }

    /** {@code FuelGradeComparison}. */
    public record GradeComparisonDto(String grade, BigDecimal avgConsumption, int segmentCount) {
    }
}
