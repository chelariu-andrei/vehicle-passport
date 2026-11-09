package com.vehiclepassport.server.passport.api.dto;

import java.time.Instant;

public record CreatePassportRequest(Instant expiresAt) {
}
