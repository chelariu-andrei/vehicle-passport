package com.vehiclepassport.server.scan.application.port.in;

import java.math.BigDecimal;

public record PartInput(String name, BigDecimal qty, BigDecimal price) {
}
