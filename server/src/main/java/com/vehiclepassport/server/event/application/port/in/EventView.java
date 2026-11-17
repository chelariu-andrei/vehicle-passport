package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * documentPresent is true exactly when attachmentCount (live attachments) is above zero. odometerKm is null for an
 * event without a reading; validityStatus is null for a type without validity.
 */
public record EventView(UUID id, String type, LocalDate date, Integer odometerKm, BigDecimal costAmount,
        String currency, String notes, String customLabel, LocalDate validFrom, LocalDate validUntil,
        DetailsView details, List<String> components, List<CustomFieldView> customFields, String validityStatus,
        String evidence, String source, boolean documentPresent, int attachmentCount) {
}
