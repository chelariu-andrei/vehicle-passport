package com.vehiclepassport.server.fuel.domain.model;

import com.vehiclepassport.server.fuel.domain.exception.InvalidFuelEntryException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** One fill-up or charge. Quantity is litres, or kWh for {@link FuelEntryType#ELECTRIC}. */
public record FuelEntry(UUID id, String vin, UUID periodId, UUID createdBy, LocalDate date, int odometerKm,
        FuelEntryType fuelType, BigDecimal quantity, BigDecimal total, BigDecimal unitPrice, String currency,
        FuelGrade grade, ChargeType chargeType, String station, String note, boolean fullTank,
        boolean missedPrevious, Instant createdAt) {

    private static final BigDecimal MAX_QUANTITY = new BigDecimal("9999");
    private static final BigDecimal MAX_TOTAL = new BigDecimal("999999");

    public static FuelEntry create(UUID id, String vin, UUID periodId, UUID createdBy, LocalDate date,
            int odometerKm, FuelEntryType fuelType, BigDecimal quantity, BigDecimal total, String currency,
            FuelGrade grade, ChargeType chargeType, String station, String note, boolean fullTank,
            boolean missedPrevious, VehicleFuel vehicleFuel, LocalDate today, Instant now) {
        if (quantity == null || quantity.signum() <= 0 || quantity.compareTo(MAX_QUANTITY) > 0) {
            throw new InvalidFuelEntryException("Quantity must be above 0 and at most 9999");
        }
        if (total == null || total.signum() < 0 || total.compareTo(MAX_TOTAL) > 0) {
            throw new InvalidFuelEntryException("Total must be between 0 and 999999");
        }
        if (odometerKm < 0) {
            throw new InvalidFuelEntryException("Odometer cannot be negative");
        }
        if (currency == null || !currency.matches("[A-Z]{3}")) {
            throw new InvalidFuelEntryException("Currency must be a 3-letter code");
        }
        if (date == null || date.isAfter(today.plusDays(1))) {
            throw new InvalidFuelEntryException("Date cannot be in the future");
        }
        if (!fuelType.allowedFor(vehicleFuel)) {
            throw new InvalidFuelEntryException(fuelType + " does not fit a " + vehicleFuel + " vehicle");
        }
        if (grade != null && fuelType == FuelEntryType.ELECTRIC) {
            throw new InvalidFuelEntryException("Grade does not apply to electric charging");
        }
        if (chargeType != null && fuelType != FuelEntryType.ELECTRIC) {
            throw new InvalidFuelEntryException("Charge type only applies to electric charging");
        }
        if (station != null && station.length() > 60) {
            throw new InvalidFuelEntryException("Station is at most 60 characters");
        }
        if (note != null && note.length() > 200) {
            throw new InvalidFuelEntryException("Note is at most 200 characters");
        }
        BigDecimal unitPrice = total.divide(quantity, 4, RoundingMode.HALF_UP);
        return new FuelEntry(id, vin, periodId, createdBy, date, odometerKm, fuelType, quantity, total, unitPrice,
                currency, grade, chargeType, station, note, fullTank, missedPrevious, now);
    }
}
