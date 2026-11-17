package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.util.List;

/**
 * Typed details, flattened. {@code kind} (SCAN, INSURANCE, ROVINIETA, ITP, SAFETY_EQUIPMENT) says which fields
 * belong to it; the others are null. SCAN: serviceName, parts, labor. INSURANCE: coverage, insurer, policyNumber.
 * ROVINIETA: duration. ITP: station, result. SAFETY_EQUIPMENT: item.
 */
public record DetailsView(String kind, String serviceName, List<PartView> parts, BigDecimal labor,
        String coverage, String insurer, String policyNumber, String duration, String station, String result,
        String item) {

    public static DetailsView scan(String serviceName, List<PartView> parts, BigDecimal labor) {
        return new DetailsView("SCAN", serviceName, parts, labor, null, null, null, null, null, null, null);
    }
}
