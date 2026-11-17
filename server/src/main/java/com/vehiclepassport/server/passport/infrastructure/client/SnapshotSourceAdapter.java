package com.vehiclepassport.server.passport.infrastructure.client;

import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.passport.application.port.out.SnapshotSourcePort;
import com.vehiclepassport.server.passport.domain.model.SnapshotCustomField;
import com.vehiclepassport.server.passport.domain.model.SnapshotDetails;
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

    /**
     * Scan details stay flat on the event, exactly as old snapshots hold them; the other kinds (a documented ITP
     * included) travel as {@code details}. The validity status is left out on purpose.
     */
    private static SnapshotEvent toEvent(EventView e) {
        DetailsView d = e.details();
        boolean scan = d != null && "SCAN".equals(d.kind());
        DetailsView flat = scan ? d : null;
        List<SnapshotPart> parts = flat == null || flat.parts() == null ? null
                : flat.parts().stream().map(p -> new SnapshotPart(p.name(), p.qty(), p.price())).toList();
        SnapshotDetails typed = d == null || scan ? null
                : new SnapshotDetails(d.kind(), d.coverage(), d.insurer(), d.policyNumber(), d.duration(),
                        d.station(), d.result(), d.item());
        List<SnapshotCustomField> fields = e.customFields() == null ? null
                : e.customFields().stream().map(f -> new SnapshotCustomField(f.label(), f.value())).toList();
        return new SnapshotEvent(e.id(), e.type(), e.date(), e.odometerKm(), e.costAmount(), e.currency(),
                e.notes(), flat == null ? null : flat.serviceName(), parts, flat == null ? null : flat.labor(),
                e.evidence(), e.documentPresent(), e.customLabel(), e.validFrom(), e.validUntil(), typed,
                e.components(), fields);
    }
}
