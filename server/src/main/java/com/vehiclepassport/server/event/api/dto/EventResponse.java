package com.vehiclepassport.server.event.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Carries no creator or ownership-period information. */
public record EventResponse(UUID id, String type, LocalDate date, int odometerKm, BigDecimal costAmount,
        String currency, String notes, DetailsResponse details, String evidence, String source,
        boolean documentPresent) {
}
