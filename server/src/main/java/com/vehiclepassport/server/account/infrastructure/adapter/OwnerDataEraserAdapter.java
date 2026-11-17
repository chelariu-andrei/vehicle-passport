package com.vehiclepassport.server.account.infrastructure.adapter;

import com.vehiclepassport.server.account.application.port.out.OwnerDataEraserPort;
import com.vehiclepassport.server.passport.application.port.in.RevokeAllForOwnerUseCase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Reaches the other features only through their {@code application/port/in}. */
@ApplicationScoped
public class OwnerDataEraserAdapter implements OwnerDataEraserPort {

    @Inject
    RevokeAllForOwnerUseCase passports;
    @Inject
    com.vehiclepassport.server.vehicle.application.port.in.DetachOwnerUseCase vehicles;
    @Inject
    com.vehiclepassport.server.event.application.port.in.DetachOwnerUseCase events;
    @Inject
    com.vehiclepassport.server.scan.application.port.in.DetachOwnerUseCase scans;
    @Inject
    com.vehiclepassport.server.fuel.application.port.in.DetachOwnerUseCase fuel;

    @Override
    public void revokePassports(UUID ownerId) {
        passports.revokeAll(ownerId);
    }

    @Override
    public void detachOwnedData(UUID ownerId, UUID tombstone) {
        // Fill-ups are personal usage data and are deleted outright; the others are handed to the tombstone.
        fuel.detach(ownerId, tombstone);
        scans.detach(ownerId, tombstone);
        events.detach(ownerId, tombstone);
        vehicles.detach(ownerId, tombstone);
    }
}
