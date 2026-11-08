package com.vehiclepassport.server.event.application.port.in;

import java.math.BigDecimal;
import java.util.List;

public record DetailsView(String serviceName, List<PartView> parts, BigDecimal labor) {
}
