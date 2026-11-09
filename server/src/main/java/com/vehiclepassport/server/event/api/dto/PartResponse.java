package com.vehiclepassport.server.event.api.dto;

import java.math.BigDecimal;

public record PartResponse(String name, BigDecimal qty, BigDecimal price) {
}
