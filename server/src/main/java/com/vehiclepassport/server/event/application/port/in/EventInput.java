package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * An event as a client states it; enum values travel as strings. A null {@code components} or
 * {@code customFields} means none.
 */
public record EventInput(String type, LocalDate date, Integer odometerKm, BigDecimal costAmount, String currency,
        String notes, String customLabel, LocalDate validFrom, LocalDate validUntil, DetailsView details,
        List<String> components, List<CustomFieldView> customFields) {
}
