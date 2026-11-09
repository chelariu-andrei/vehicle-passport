package com.vehiclepassport.server.vehicle.api.dto;

import java.time.Instant;
import java.util.UUID;

/** Shows only the claim id and filing date, never the claimant's identity. */
public record PendingClaimResponse(UUID claimId, Instant filedAt) {
}
