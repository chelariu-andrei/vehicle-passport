package com.vehiclepassport.server.vehicle.domain.model;

import com.vehiclepassport.server.vehicle.domain.exception.ClaimNotPendingException;
import java.time.Instant;
import java.util.UUID;

public record OwnershipClaim(UUID id, Vin vin, UUID claimantId, ClaimStatus status, Instant filedAt,
                             Instant decidedAt) {

    public static OwnershipClaim file(UUID id, Vin vin, UUID claimantId, Instant at) {
        return new OwnershipClaim(id, vin, claimantId, ClaimStatus.PENDING, at, null);
    }

    public boolean isPending() {
        return status == ClaimStatus.PENDING;
    }

    public OwnershipClaim approve(Instant at) {
        return decide(ClaimStatus.APPROVED, at);
    }

    public OwnershipClaim reject(Instant at) {
        return decide(ClaimStatus.REJECTED, at);
    }

    public OwnershipClaim withdraw(Instant at) {
        return decide(ClaimStatus.WITHDRAWN, at);
    }

    private OwnershipClaim decide(ClaimStatus next, Instant at) {
        if (!isPending()) {
            throw new ClaimNotPendingException("Claim " + id + " is already " + status);
        }
        return new OwnershipClaim(id, vin, claimantId, next, filedAt, at);
    }
}
