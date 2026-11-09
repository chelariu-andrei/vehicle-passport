package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.event.application.port.in.CheckOdometerUseCase;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.scan.application.port.in.PartInput;
import com.vehiclepassport.server.scan.application.port.out.ConfirmedEvent;
import com.vehiclepassport.server.scan.application.port.out.EventSavePort;
import com.vehiclepassport.server.scan.application.port.out.OdometerCheckPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class EventFeatureAdapter implements OdometerCheckPort, EventSavePort {

    private final CheckOdometerUseCase odometer;
    private final SaveConfirmedEventUseCase events;

    @Inject
    public EventFeatureAdapter(CheckOdometerUseCase odometer, SaveConfirmedEventUseCase events) {
        this.odometer = odometer;
        this.events = events;
    }

    @Override
    public boolean isConsistent(String vin, LocalDate date, int km) {
        return odometer.isConsistent(vin, date, km);
    }

    @Override
    public UUID saveDocumented(ConfirmedEvent e) {
        List<PartView> parts = e.parts() == null ? List.of()
                : e.parts().stream().map(EventFeatureAdapter::toView).toList();
        DetailsView details = new DetailsView(e.serviceName(), parts, e.labor());
        return events.save(new SaveConfirmedEventCommand(e.userId(), e.vin(), e.type(), e.date(),
                e.odometerKm(), e.total(), e.currency(), e.notes(), details, e.documentKey()));
    }

    private static PartView toView(PartInput p) {
        return new PartView(p.name(), p.qty(), p.price());
    }
}
