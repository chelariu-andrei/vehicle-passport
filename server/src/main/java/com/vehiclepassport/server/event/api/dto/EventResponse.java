package com.vehiclepassport.server.event.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Carries no creator or ownership-period information. components and customFields are always present. */
public record EventResponse(UUID id, String type, LocalDate date, Integer odometerKm, BigDecimal costAmount,
        String currency, String notes, String customLabel, LocalDate validFrom, LocalDate validUntil,
        String validityStatus, DetailsDto details, List<String> components, List<CustomFieldDto> customFields,
        String evidence, String source, boolean documentPresent, int attachmentCount) {
}
