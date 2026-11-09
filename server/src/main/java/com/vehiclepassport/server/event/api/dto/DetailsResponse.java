package com.vehiclepassport.server.event.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record DetailsResponse(String serviceName, List<PartResponse> parts, BigDecimal labor) {
}
