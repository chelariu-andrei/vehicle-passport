package com.vehiclepassport.server.vehicle.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.vehiclepassport.server.vehicle.domain.exception.ClaimNotPendingException;
import com.vehiclepassport.server.vehicle.domain.model.ClaimStatus;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipClaim;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OwnershipClaimTest {

    private static final Instant FILED = Instant.parse("2026-01-15T10:00:00Z");
    private static final Instant DECIDED = Instant.parse("2026-01-16T10:00:00Z");

    private static OwnershipClaim pending() {
        return OwnershipClaim.file(UUID.randomUUID(), Vin.of("WVWZZZ1JZXW000001"), UUID.randomUUID(), FILED);
    }

    @Test
    void approve_from_pending() {
        OwnershipClaim claim = pending().approve(DECIDED);
        assertEquals(ClaimStatus.APPROVED, claim.status());
        assertEquals(DECIDED, claim.decidedAt());
    }

    @Test
    void reject_from_pending() {
        assertEquals(ClaimStatus.REJECTED, pending().reject(DECIDED).status());
    }

    @Test
    void withdraw_from_pending() {
        assertEquals(ClaimStatus.WITHDRAWN, pending().withdraw(DECIDED).status());
    }

    @Test
    void second_transition_throws_claim_not_pending() {
        OwnershipClaim rejected = pending().reject(DECIDED);
        ClaimNotPendingException e = assertThrows(ClaimNotPendingException.class, () -> rejected.approve(DECIDED));
        assertEquals("claim-not-pending", e.code());
        assertThrows(ClaimNotPendingException.class, () -> rejected.withdraw(DECIDED));
    }
}
