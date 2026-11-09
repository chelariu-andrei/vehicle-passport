package com.vehiclepassport.server.vehicle.application.port.out;

import com.vehiclepassport.server.vehicle.domain.model.OwnershipClaim;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnershipRepositoryPort {

    void lockVin(Vin vin);

    Optional<OwnershipPeriod> findOpen(Vin vin);

    Optional<OwnershipPeriod> findById(UUID id);

    List<OwnershipPeriod> findOpenByOwner(UUID ownerId);

    void save(OwnershipPeriod period);

    Optional<OwnershipClaim> findClaim(UUID id);

    Optional<OwnershipClaim> findPendingClaim(Vin vin, UUID claimantId);

    List<OwnershipClaim> findPendingClaims(Vin vin);

    void save(OwnershipClaim claim);
}
