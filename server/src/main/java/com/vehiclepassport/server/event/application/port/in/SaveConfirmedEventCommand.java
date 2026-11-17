package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A scan the user confirmed. The scanned file (documentKey, contentType, sha256, sizeBytes) becomes the event's
 * SCAN_SOURCE attachment. sha256 is null and sizeBytes 0 for scans submitted before hashing existed.
 * validUntil and itpResult are allowed only for an ITP, whose station is the details' serviceName.
 */
public record SaveConfirmedEventCommand(UUID userId, String vin, String type, LocalDate date, int odometerKm,
        BigDecimal total, String currency, String notes, DetailsView details, String documentKey,
        String contentType, String sha256, long sizeBytes, LocalDate validUntil, String itpResult) {
}
