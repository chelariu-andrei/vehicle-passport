package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** documentPresent is true exactly when attachmentCount (live attachments) is above zero. */
public record EventView(UUID id, String type, LocalDate date, int odometerKm, BigDecimal costAmount,
        String currency, String notes, DetailsView details, String evidence, String source,
        boolean documentPresent, int attachmentCount) {
}
