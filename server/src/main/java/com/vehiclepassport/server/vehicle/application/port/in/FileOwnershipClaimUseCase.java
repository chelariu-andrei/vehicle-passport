package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.UUID;

public interface FileOwnershipClaimUseCase {

    /** Files a claim on a vehicle owned by someone else; idempotent per claimant and VIN while pending. */
    UUID file(String vin, UUID claimantId);

    void withdraw(UUID claimId, UUID claimantId);
}
