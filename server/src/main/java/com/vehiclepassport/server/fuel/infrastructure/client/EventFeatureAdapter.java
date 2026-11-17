package com.vehiclepassport.server.fuel.infrastructure.client;

import com.vehiclepassport.server.event.application.port.in.CheckOdometerUseCase;
import com.vehiclepassport.server.event.application.port.in.LatestOdometerUseCase;
import com.vehiclepassport.server.fuel.application.port.out.LatestOdometerPort;
import com.vehiclepassport.server.fuel.application.port.out.OdometerCheckPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDate;
import java.util.Optional;

/** The one-way link to {@code event}: fuel reads its odometer history, event never reads fuel. */
@ApplicationScoped
public class EventFeatureAdapter implements OdometerCheckPort, LatestOdometerPort {

    private final CheckOdometerUseCase check;
    private final LatestOdometerUseCase latest;

    @Inject
    public EventFeatureAdapter(CheckOdometerUseCase check, LatestOdometerUseCase latest) {
        this.check = check;
        this.latest = latest;
    }

    @Override
    public boolean isConsistent(String vin, LocalDate date, int km) {
        return check.isConsistent(vin, date, km);
    }

    @Override
    public Optional<Integer> latestKm(String vin) {
        return latest.latestKm(vin);
    }
}
