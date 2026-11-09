package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.testsupport.Resettable;
import com.vehiclepassport.server.vehicle.application.port.out.OwnershipRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipClaim;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Alternative
@ApplicationScoped
public class FakeOwnershipRepository implements OwnershipRepositoryPort, Resettable {

    private final Map<UUID, OwnershipPeriod> store = new LinkedHashMap<>();
    private final Map<UUID, OwnershipClaim> claims = new LinkedHashMap<>();

    @Override
    public void lockVin(Vin vin) {
        // single-threaded tests: nothing to lock
    }

    @Override
    public Optional<OwnershipPeriod> findOpen(Vin vin) {
        return store.values().stream().filter(p -> p.vin().equals(vin) && p.isOpen()).findFirst();
    }

    @Override
    public Optional<OwnershipPeriod> findById(UUID id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public List<OwnershipPeriod> findOpenByOwner(UUID ownerId) {
        return store.values().stream().filter(p -> p.ownerId().equals(ownerId) && p.isOpen()).toList();
    }

    @Override
    public void save(OwnershipPeriod period) {
        store.put(period.id(), period);
    }

    @Override
    public Optional<OwnershipClaim> findClaim(UUID id) {
        return Optional.ofNullable(claims.get(id));
    }

    @Override
    public Optional<OwnershipClaim> findPendingClaim(Vin vin, UUID claimantId) {
        return claims.values().stream()
            .filter(c -> c.vin().equals(vin) && c.claimantId().equals(claimantId) && c.isPending())
            .findFirst();
    }

    @Override
    public List<OwnershipClaim> findPendingClaims(Vin vin) {
        return claims.values().stream().filter(c -> c.vin().equals(vin) && c.isPending()).toList();
    }

    @Override
    public void save(OwnershipClaim claim) {
        claims.put(claim.id(), claim);
    }

    @Override
    public void reset() {
        store.clear();
        claims.clear();
    }
}
