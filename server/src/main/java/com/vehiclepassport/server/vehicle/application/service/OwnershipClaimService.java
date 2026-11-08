package com.vehiclepassport.server.vehicle.application.service;

import com.vehiclepassport.server.vehicle.application.port.in.DecideOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.FileOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.PendingClaimView;
import com.vehiclepassport.server.vehicle.application.port.out.OwnershipRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.exception.AlreadyOwnerException;
import com.vehiclepassport.server.vehicle.domain.exception.ClaimNotFoundException;
import com.vehiclepassport.server.vehicle.domain.exception.VehicleNotFoundException;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipClaim;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class OwnershipClaimService implements FileOwnershipClaimUseCase, DecideOwnershipClaimUseCase {

    private final OwnershipRepositoryPort ownerships;
    private final Clock clock;

    @Inject
    public OwnershipClaimService(OwnershipRepositoryPort ownerships, Clock clock) {
        this.ownerships = ownerships;
        this.clock = clock;
    }

    @Override
    @Transactional
    public UUID file(String vin, UUID claimantId) {
        Vin parsed = Vin.of(vin);
        ownerships.lockVin(parsed);
        OwnershipPeriod open = ownerships.findOpen(parsed).orElseThrow(() -> notFound(parsed));
        if (open.ownerId().equals(claimantId)) {
            throw new AlreadyOwnerException("You already own vehicle " + parsed.value());
        }
        return ownerships.findPendingClaim(parsed, claimantId)
                .map(OwnershipClaim::id)
                .orElseGet(() -> {
                    OwnershipClaim claim = OwnershipClaim.file(UUID.randomUUID(), parsed, claimantId, clock.instant());
                    ownerships.save(claim);
                    return claim.id();
                });
    }

    @Override
    @Transactional
    public void withdraw(UUID claimId, UUID claimantId) {
        OwnershipClaim claim = ownerships.findClaim(claimId)
                .filter(c -> c.claimantId().equals(claimantId))
                .orElseThrow(() -> claimNotFound(claimId));
        ownerships.lockVin(claim.vin());
        // Re-read under the lock so a concurrent decision is not overwritten.
        OwnershipClaim current = ownerships.findClaim(claimId).orElseThrow(() -> claimNotFound(claimId));
        ownerships.save(current.withdraw(clock.instant()));
    }

    @Override
    public List<PendingClaimView> listPending(String vin, UUID ownerId) {
        Vin parsed = Vin.of(vin);
        requireOwner(parsed, ownerId);
        return ownerships.findPendingClaims(parsed).stream()
                .sorted(Comparator.comparing(OwnershipClaim::filedAt))
                .map(c -> new PendingClaimView(c.id(), c.filedAt()))
                .toList();
    }

    @Override
    @Transactional
    public void approve(String vin, UUID claimId, UUID ownerId) {
        Vin parsed = Vin.of(vin);
        ownerships.lockVin(parsed);
        OwnershipPeriod ownerPeriod = requireOwner(parsed, ownerId);
        OwnershipClaim claim = requireClaim(parsed, claimId);
        Instant now = clock.instant();
        OwnershipClaim approved = claim.approve(now); // throws before anything is written if not pending
        ownerships.save(ownerPeriod.close(now));
        ownerships.save(new OwnershipPeriod(UUID.randomUUID(), parsed, claim.claimantId(), now, null));
        ownerships.save(approved);
        for (OwnershipClaim other : ownerships.findPendingClaims(parsed)) {
            ownerships.save(other.reject(now));
        }
    }

    @Override
    @Transactional
    public void reject(String vin, UUID claimId, UUID ownerId) {
        Vin parsed = Vin.of(vin);
        ownerships.lockVin(parsed);
        requireOwner(parsed, ownerId);
        ownerships.save(requireClaim(parsed, claimId).reject(clock.instant()));
    }

    private OwnershipPeriod requireOwner(Vin vin, UUID userId) {
        return ownerships.findOpen(vin)
                .filter(p -> p.ownerId().equals(userId))
                .orElseThrow(() -> notFound(vin));
    }

    private OwnershipClaim requireClaim(Vin vin, UUID claimId) {
        return ownerships.findClaim(claimId)
                .filter(c -> c.vin().equals(vin))
                .orElseThrow(() -> claimNotFound(claimId));
    }

    private static VehicleNotFoundException notFound(Vin vin) {
        return new VehicleNotFoundException("Vehicle " + vin.value() + " not found");
    }

    private static ClaimNotFoundException claimNotFound(UUID claimId) {
        return new ClaimNotFoundException("Claim " + claimId + " not found");
    }
}
