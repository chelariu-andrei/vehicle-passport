package com.vehiclepassport.server.scan.api.dto;

import java.math.BigDecimal;

public record ScanPartResponse(String name, BigDecimal qty, BigDecimal price) {
}
