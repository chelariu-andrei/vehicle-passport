package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

public record VehicleEvent(
        UUID id,
        String vin,
        EventType type,
        LocalDate date,
        int odometerKm,
        BigDecimal costAmount,
        String currency,
        String notes,
        EventDetails details,
        EvidenceLevel evidence,
        EventSource source,
        UUID createdBy,
        UUID periodId,
        String documentKey,
        Instant createdAt,
        Instant deletedAt) {

    private static final Pattern CURRENCY = Pattern.compile("[A-Z]{3}");

    /** A manually entered event: no details, no document, confirmed by the user. */
    public static VehicleEvent manual(String vin, EventType type, LocalDate date, int odometerKm,
            BigDecimal costAmount, String currency, String notes, UUID createdBy, UUID periodId, Clock clock) {
        if (type == null) {
            throw new InvalidEventException("Event type is required");
        }
        if (date == null) {
            throw new InvalidEventException("Event date is required");
        }
        if (date.isAfter(LocalDate.now(clock))) {
            throw new InvalidEventException("Event date cannot be in the future");
        }
        if (odometerKm < 0) {
            throw new InvalidEventException("Odometer cannot be negative");
        }
        if (costAmount == null) {
            throw new InvalidEventException("Cost is required");
        }
        if (costAmount.signum() < 0) {
            throw new InvalidEventException("Cost cannot be negative");
        }
        String normalisedCurrency = currency == null ? null : currency.trim().toUpperCase(Locale.ROOT);
        if (normalisedCurrency == null || !CURRENCY.matcher(normalisedCurrency).matches()) {
            throw new InvalidEventException("Currency must be a three-letter code");
        }
        return new VehicleEvent(UUID.randomUUID(), vin, type, date, odometerKm, costAmount, normalisedCurrency,
                notes, null, EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, createdBy, periodId, null,
                clock.instant(), null);
    }
}
