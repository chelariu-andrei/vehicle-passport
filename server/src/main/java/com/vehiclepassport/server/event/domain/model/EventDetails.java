package com.vehiclepassport.server.event.domain.model;

import java.math.BigDecimal;
import java.util.List;

public record EventDetails(String serviceName, List<PartLine> parts, BigDecimal labor) {

    public EventDetails {
        parts = parts == null ? List.of() : List.copyOf(parts);
    }
}
