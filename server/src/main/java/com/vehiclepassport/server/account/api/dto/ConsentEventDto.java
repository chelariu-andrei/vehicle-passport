package com.vehiclepassport.server.account.api.dto;

import java.time.Instant;

public record ConsentEventDto(String type, String version, boolean granted, String source, Instant at) {
}
