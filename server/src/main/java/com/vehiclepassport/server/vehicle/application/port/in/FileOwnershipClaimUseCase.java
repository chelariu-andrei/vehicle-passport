package com.vehiclepassport.server.vehicle.application.port.in;

import java.time.Instant;
import java.util.UUID;

public interface FileOwnershipClaimUseCase {

    /** Files a claim on a vehicle owned by someone else; idempotent per claimant and VIN while pending. */
    FiledClaim file(String vin, UUID claimantId);

    record FiledClaim(UUID claimId, Instant filedAt) {
    }

    void withdraw(UUID claimId, UUID claimantId);
}
