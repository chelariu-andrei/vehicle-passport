package com.vehiclepassport.server.event.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The facts of an event as the client states them: validFrom/validUntil are the input values, before the type rule
 * turns them into a {@link Validity}. A documented event's facts are locked.
 */
public record EventFacts(EventType type, LocalDate date, Integer odometerKm, BigDecimal costAmount, String currency,
        String customLabel, LocalDate validFrom, LocalDate validUntil, EventDetails details) {
}