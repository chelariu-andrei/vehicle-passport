package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.OdometerPolicy;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import java.time.Clock;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class EventService implements AddEventUseCase, GetTimelineUseCase {

    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final EventRepositoryPort events;
    private final ActiveOwnerPort owners;
    private final Clock clock;

    @Inject
    public EventService(EventRepositoryPort events, ActiveOwnerPort owners, Clock clock) {
        this.events = events;
        this.owners = owners;
        this.clock = clock;
    }

    @Override
    @Transactional
    public EventView add(AddEventCommand c) {
        UUID periodId = owners.assertActiveOwner(c.vin(), c.userId());
        VehicleEvent event = VehicleEvent.manual(c.vin(), EventType.parse(c.type()), c.date(), c.odometerKm(),
                c.costAmount(), c.currency(), c.notes(), c.userId(), periodId, clock);
        events.lockTimeline(event.vin());
        Neighbours around = events.neighbours(event.vin(), event.date(), event.createdAt(), event.id());
        OdometerPolicy.check(around.previousKm(), event.odometerKm(), around.nextKm());
        events.save(event);
        return toView(event);
    }

    @Override
    @Transactional
    public TimelinePage get(UUID userId, String vin, String cursor, int limit) {
        owners.assertActiveOwner(vin, userId);
        int size = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
        TimelineCursor after = cursor == null || cursor.isBlank() ? null : TimelineCursor.decode(cursor);
        List<VehicleEvent> fetched = events.page(vin, after, size + 1);
        boolean more = fetched.size() > size;
        List<VehicleEvent> window = more ? fetched.subList(0, size) : fetched;
        String next = null;
        if (more) {
            VehicleEvent last = window.get(window.size() - 1);
            next = new TimelineCursor(last.date(), last.createdAt(), last.id()).encode();
        }
        return new TimelinePage(window.stream().map(EventService::toView).toList(), next);
    }

    private static EventView toView(VehicleEvent e) {
        return new EventView(e.id(), e.type().name(), e.date(), e.odometerKm(), e.costAmount(), e.currency(),
                e.notes(), toView(e.details()), e.evidence().name(), e.source().name(), e.documentKey() != null);
    }

    private static DetailsView toView(EventDetails d) {
        if (d == null) {
            return null;
        }
        return new DetailsView(d.serviceName(),
                d.parts().stream().map(p -> new PartView(p.name(), p.qty(), p.price())).toList(), d.labor());
    }
}
