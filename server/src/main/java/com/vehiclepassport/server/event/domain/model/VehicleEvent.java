package com.vehiclepassport.server.event.domain.model;

import com.vehiclepassport.server.event.domain.exception.DocumentedEventImmutableException;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
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
        String normalised = validate(type, date, odometerKm, costAmount, currency, clock);
        return new VehicleEvent(UUID.randomUUID(), vin, type, date, odometerKm, costAmount, normalised,
                notes, null, EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, createdBy, periodId, null,
                clock.instant(), null);
    }

    /** An event extracted from a scanned document and confirmed by the user: backed by the document. */
    public static VehicleEvent documented(String vin, EventType type, LocalDate date, int odometerKm,
            BigDecimal costAmount, String currency, String notes, EventDetails details, String documentKey,
            UUID createdBy, UUID periodId, Clock clock) {
        String normalised = validate(type, date, odometerKm, costAmount, currency, clock);
        return new VehicleEvent(UUID.randomUUID(), vin, type, date, odometerKm, costAmount, normalised,
                notes, details, EvidenceLevel.DOCUMENTED, EventSource.SCAN, createdBy, periodId, documentKey,
                clock.instant(), null);
    }

    /**
     * The event after an edit. Identity, creation time, details, document, source and evidence are kept.
     * A documented event accepts only a change of notes.
     */
    public VehicleEvent edited(EventType newType, LocalDate newDate, int newKm, BigDecimal newCost,
            String newCurrency, String newNotes, Clock clock) {
        if (evidence.isAtLeast(EvidenceLevel.DOCUMENTED)) {
            String currencyNow = newCurrency == null ? null : newCurrency.trim().toUpperCase(Locale.ROOT);
            boolean dataChanged = newType != type
                    || !Objects.equals(newDate, date)
                    || newKm != odometerKm
                    || newCost == null || newCost.compareTo(costAmount) != 0
                    || !Objects.equals(currencyNow, currency);
            if (dataChanged) {
                throw new DocumentedEventImmutableException(
                        "Only the notes of a documented event can be changed");
            }
            return withFields(type, date, odometerKm, costAmount, currency, newNotes);
        }
        String normalised = validate(newType, newDate, newKm, newCost, newCurrency, clock);
        return withFields(newType, newDate, newKm, newCost, normalised, newNotes);
    }

    public VehicleEvent deleted(Instant when) {
        return new VehicleEvent(id, vin, type, date, odometerKm, costAmount, currency, notes, details, evidence,
                source, createdBy, periodId, documentKey, createdAt, when);
    }

    private VehicleEvent withFields(EventType t, LocalDate d, int km, BigDecimal cost, String cur, String n) {
        return new VehicleEvent(id, vin, t, d, km, cost, cur, n, details, evidence, source, createdBy, periodId,
                documentKey, createdAt, deletedAt);
    }

    private static String validate(EventType type, LocalDate date, int odometerKm, BigDecimal costAmount,
            String currency, Clock clock) {
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
        return normalisedCurrency;
    }
}
