package com.vehiclepassport.server.event.domain.model;

import java.math.BigDecimal;

public record PartLine(String name, BigDecimal qty, BigDecimal price) {
}
