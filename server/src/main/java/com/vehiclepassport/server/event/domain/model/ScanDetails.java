package com.vehiclepassport.server.event.domain.model;

import java.math.BigDecimal;
import java.util.List;

/** What a scan confirm read from the document. Produced only by a scan and read-only afterwards. */
public record ScanDetails(String serviceName, List<PartLine> parts, BigDecimal labor) implements EventDetails {

    public ScanDetails {
        parts = parts == null ? List.of() : List.copyOf(parts);
    }

    @Override
    public DetailsKind kind() {
        return DetailsKind.SCAN;
    }
}