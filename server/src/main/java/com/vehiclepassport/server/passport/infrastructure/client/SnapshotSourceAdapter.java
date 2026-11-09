package com.vehiclepassport.server.passport.infrastructure.client;

import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.passport.application.port.out.SnapshotSourcePort;
import com.vehiclepassport.server.passport.domain.model.SnapshotEvent;
import com.vehiclepassport.server.passport.domain.model.SnapshotPart;
import com.vehiclepassport.server.passport.domain.model.SnapshotVehicle;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.GetVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class SnapshotSourceAdapter implements SnapshotSourcePort {

    private final AssertActiveOwnerUseCase owners;
    private final GetVehicleUseCase vehicles;
    private final ReadVehicleHistoryUseCase history;

    @Inject
    public SnapshotSourceAdapter(AssertActiveOwnerUseCase owners, GetVehicleUseCase vehicles,
            ReadVehicleHistoryUseCase history) {
        this.owners = owners;
        this.vehicles = vehicles;
        this.history = history;
    }

    @Override
    public SnapshotSource load(String vin, UUID userId) {
        owners.assertActiveOwner(vin, userId);
        VehicleView v = vehicles.get(vin, userId);
        List<SnapshotEvent> events = history.history(v.vin()).stream().map(SnapshotSourceAdapter::toEvent).toList();
        return new SnapshotSource(new SnapshotVehicle(v.vin(), v.make(), v.model(), v.engine(), v.year(), v.fuel()),
                events);
    }

    private static SnapshotEvent toEvent(EventView e) {
        DetailsView d = e.details();
        List<SnapshotPart> parts = d == null ? null
                : d.parts().stream().map(p -> new SnapshotPart(p.name(), p.qty(), p.price())).toList();
        return new SnapshotEvent(e.id(), e.type(), e.date(), e.odometerKm(), e.costAmount(), e.currency(),
                e.notes(), d == null ? null : d.serviceName(), parts, d == null ? null : d.labor(), e.evidence(),
                e.documentPresent());
    }
}
