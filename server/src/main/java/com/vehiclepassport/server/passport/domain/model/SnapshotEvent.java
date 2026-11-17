package com.vehiclepassport.server.passport.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * sortId only orders events; it is never written to the canonical JSON. details is null for scan details (those stay
 * flat in serviceName, parts and labor); components and customFields may be null or empty. The validity status is
 * not part of the snapshot: it depends on today's date.
 */
public record SnapshotEvent(
        UUID sortId,
        String type,
        LocalDate date,
        Integer odometerKm,
        BigDecimal costAmount,
        String currency,
        String notes,
        String serviceName,
        List<SnapshotPart> parts,
        BigDecimal labor,
        String evidence,
        boolean documentPresent,
        String customLabel,
        LocalDate validFrom,
        LocalDate validUntil,
        SnapshotDetails details,
        List<String> components,
        List<SnapshotCustomField> customFields) {

    /** An event without any of the extended fields, as every event was before them. */
    public SnapshotEvent(UUID sortId, String type, LocalDate date, Integer odometerKm, BigDecimal costAmount,
            String currency, String notes, String serviceName, List<SnapshotPart> parts, BigDecimal labor,
            String evidence, boolean documentPresent) {
        this(sortId, type, date, odometerKm, costAmount, currency, notes, serviceName, parts, labor, evidence,
                documentPresent, null, null, null, null, null, null);
    }
}
