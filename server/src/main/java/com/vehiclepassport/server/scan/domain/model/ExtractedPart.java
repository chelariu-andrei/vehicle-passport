package com.vehiclepassport.server.scan.domain.model;

import java.math.BigDecimal;

public record ExtractedPart(String name, BigDecimal qty, BigDecimal price) {
}
