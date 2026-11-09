package com.vehiclepassport.server.vehicle.application.port.in;

import java.time.Instant;
import java.util.UUID;

/** Deliberately omits the claimant's identity. */
public record PendingClaimView(UUID claimId, Instant filedAt) {
}
