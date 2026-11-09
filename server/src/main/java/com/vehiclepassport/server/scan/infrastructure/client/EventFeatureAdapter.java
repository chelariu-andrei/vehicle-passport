package com.vehiclepassport.server.scan.infrastructure.client;

import com.vehiclepassport.server.event.application.port.in.CheckOdometerUseCase;
import com.vehiclepassport.server.scan.application.port.out.OdometerCheckPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDate;

@ApplicationScoped
public class EventFeatureAdapter implements OdometerCheckPort {

    private final CheckOdometerUseCase events;

    @Inject
    public EventFeatureAdapter(CheckOdometerUseCase events) {
        this.events = events;
    }

    @Override
    public boolean isConsistent(String vin, LocalDate date, int km) {
        return events.isConsistent(vin, date, km);
    }
}
