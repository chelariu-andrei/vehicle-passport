package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.DeadlineItemView;
import com.vehiclepassport.server.event.application.port.in.DeadlinesUseCase;
import com.vehiclepassport.server.event.application.port.in.DeadlinesView;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.DeadlinesPolicy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

/** Document deadlines from the VIN's validity entries, "today" taken like the timeline's validity status. */
@ApplicationScoped
public class DeadlinesService implements DeadlinesUseCase {

    private final EventRepositoryPort events;
    private final ActiveOwnerPort owners;
    private final Clock clock;

    @Inject
    public DeadlinesService(EventRepositoryPort events, ActiveOwnerPort owners, Clock clock) {
        this.events = events;
        this.owners = owners;
        this.clock = clock;
    }

    @Override
    @Transactional
    public DeadlinesView get(UUID userId, String vin) {
        String canonical = owners.assertActiveOwner(vin, userId).vin();
        return new DeadlinesView(DeadlinesPolicy.of(events.validityEntries(canonical), LocalDate.now(clock)).stream()
                .map(d -> new DeadlineItemView(d.kind().name(), d.status().name(), d.validUntil(), d.daysLeft(),
                        d.eventId()))
                .toList());
    }
}
