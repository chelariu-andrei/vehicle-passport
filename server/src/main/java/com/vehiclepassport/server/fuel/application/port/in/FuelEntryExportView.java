package com.vehiclepassport.server.fuel.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A fill-up together with the car it belongs to, for other features (the data export). Free of fuel domain types:
 * fuel type, unit, grade and charge type are their contract names.
 */
public record FuelEntryExportView(String vin, UUID id, LocalDate date, int odometerKm, String fuelType,
        BigDecimal quantity, String unit, BigDecimal total, BigDecimal unitPrice, String currency, boolean fullTank,
        boolean missedPrevious, String grade, String chargeType, String station, String note,
        BigDecimal consumption) {
}
