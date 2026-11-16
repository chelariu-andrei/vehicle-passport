package com.vehiclepassport.server.scan.application.port.out;

import com.vehiclepassport.server.scan.application.port.in.PartInput;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The scanned file (documentKey, contentType, sha256, sizeBytes) becomes the event's source document. */
public record ConfirmedEvent(UUID userId, String vin, String type, LocalDate date, int odometerKm,
        BigDecimal total, String currency, String notes, String serviceName, List<PartInput> parts,
        BigDecimal labor, String documentKey, String contentType, String sha256, long sizeBytes) {
}
