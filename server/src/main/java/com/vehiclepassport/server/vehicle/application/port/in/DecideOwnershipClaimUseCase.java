package com.vehiclepassport.server.vehicle.application.port.in;

import java.util.List;
import java.util.UUID;

public interface DecideOwnershipClaimUseCase {

    List<PendingClaimView> listPending(String vin, UUID ownerId);

    void approve(String vin, UUID claimId, UUID ownerId);

    void reject(String vin, UUID claimId, UUID ownerId);
}
