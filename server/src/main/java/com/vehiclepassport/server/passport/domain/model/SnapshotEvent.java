package com.vehiclepassport.server.passport.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** sortId only orders events; it is never written to the canonical JSON. */
public record SnapshotEvent(
        UUID sortId,
        String type,
        LocalDate date,
        int odometerKm,
        BigDecimal costAmount,
        String currency,
        String notes,
        String serviceName,
        List<SnapshotPart> parts,
        BigDecimal labor,
        String evidence,
        boolean documentPresent) {}
