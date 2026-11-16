package com.vehiclepassport.server.account.infrastructure.adapter;

import com.vehiclepassport.server.account.application.port.out.OwnerStatsPort;
import com.vehiclepassport.server.account.domain.model.OwnerStats;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Counts an owner's records through the other features' public use cases only. */
@ApplicationScoped
public class OwnerStatsAdapter implements OwnerStatsPort {

    @Inject
    com.vehiclepassport.server.vehicle.application.port.in.CountOwnedByOwnerUseCase vehicles;
    @Inject
    com.vehiclepassport.server.event.application.port.in.CountOwnedByOwnerUseCase events;
    @Inject
    com.vehiclepassport.server.passport.application.port.in.CountOwnedByOwnerUseCase passports;

    @Override
    public OwnerStats statsFor(UUID ownerId) {
        return new OwnerStats(vehicles.count(ownerId), events.count(ownerId), passports.count(ownerId));
    }
}
