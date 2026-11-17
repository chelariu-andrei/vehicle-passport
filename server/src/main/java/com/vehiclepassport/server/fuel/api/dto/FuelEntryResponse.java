package com.vehiclepassport.server.fuel.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Carries no creator or ownership-period information. Null fields are sent as null. */
public record FuelEntryResponse(UUID id, LocalDate date, int odometerKm, String fuelType, BigDecimal quantity,
        String unit, BigDecimal total, BigDecimal unitPrice, String currency, boolean fullTank,
        boolean missedPrevious, String grade, String chargeType, String station, String note,
        BigDecimal consumption) {
}
