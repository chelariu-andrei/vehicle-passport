package com.vehiclepassport.server.scan.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The user's final data. A null eventType means SERVICE, a null currency means RON. */
public record ConfirmScanCommand(UUID userId, UUID jobId, String eventType, LocalDate date, int odometerKm,
        String serviceName, List<PartInput> parts, BigDecimal labor, BigDecimal total, String currency,
        String notes) {
}
