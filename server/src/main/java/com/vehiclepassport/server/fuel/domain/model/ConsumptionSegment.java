package com.vehiclepassport.server.fuel.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Consumption between two full fill-ups, keyed by the closing one. {@code grade} is set only when every entry after
 * the opening fill-up up to and including the closing one has that same grade.
 */
public record ConsumptionSegment(UUID closingEntryId, LocalDate date, int odometerKm, BigDecimal quantity, int km,
        BigDecimal per100km, FuelGrade grade) {
}
