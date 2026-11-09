package com.vehiclepassport.server.vehicle.api.dto;

import java.time.Instant;
import java.util.UUID;

public record ClaimFiledResponse(UUID claimId, Instant filedAt) {
}
