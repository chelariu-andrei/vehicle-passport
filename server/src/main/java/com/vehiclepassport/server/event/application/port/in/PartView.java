package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;

public record PartView(String name, BigDecimal qty, BigDecimal price) {
}
