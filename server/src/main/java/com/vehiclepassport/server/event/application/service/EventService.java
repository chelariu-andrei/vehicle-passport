package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.CheckOdometerUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventDocument;
import com.vehiclepassport.server.event.application.port.in.GetEventDocumentUseCase;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import com.vehiclepassport.server.event.application.port.in.UpdateEventUseCase;
import com.vehiclepassport.server.event.domain.exception.DocumentRestrictedException;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.event.domain.exception.OdometerInconsistentException;
import com.vehiclepassport.server.event.domain.exception.PriorPeriodEventException;
import com.vehiclepassport.server.event.domain.model.PartLine;
import java.time.LocalDate;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.DocumentStoragePort;
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
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class EventService implements AddEventUseCase, GetTimelineUseCase, UpdateEventUseCase, DeleteEventUseCase,
        SaveConfirmedEventUseCase, CheckOdometerUseCase, ReadVehicleHistoryUseCase, GetEventDocumentUseCase {

    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final EventRepositoryPort events;
    private final ActiveOwnerPort owners;
    private final DocumentStoragePort documents;
    private final Clock clock;

    @Inject
    public EventService(EventRepositoryPort events, ActiveOwnerPort owners, DocumentStoragePort documents,
            Clock clock) {
        this.events = events;
        this.owners = owners;
        this.documents = documents;
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

    @Override
    @Transactional
    public EventView update(UpdateEventCommand c) {
        VehicleEvent current = loadOwned(c.vin(), c.userId(), c.eventId());
        VehicleEvent edited = current.edited(EventType.parse(c.type()), c.date(), c.odometerKm(), c.costAmount(),
                c.currency(), c.notes(), clock);
        Neighbours around = events.neighbours(edited.vin(), edited.date(), edited.createdAt(), edited.id());
        OdometerPolicy.check(around.previousKm(), edited.odometerKm(), around.nextKm());
        events.save(edited);
        return toView(edited);
    }

    @Override
    @Transactional
    public void delete(UUID userId, String vin, UUID eventId) {
        VehicleEvent current = loadOwned(vin, userId, eventId);
        events.save(current.deleted(clock.instant()));
    }

    @Override
    @Transactional
    public UUID save(SaveConfirmedEventCommand c) {
        UUID periodId = owners.assertActiveOwner(c.vin(), c.userId());
        VehicleEvent event = VehicleEvent.documented(c.vin(), EventType.parse(c.type()), c.date(), c.odometerKm(),
                c.total(), c.currency(), c.notes(), toDomain(c.details()), c.documentKey(), c.userId(), periodId,
                clock);
        events.lockTimeline(event.vin());
        Neighbours around = events.neighbours(event.vin(), event.date(), event.createdAt(), event.id());
        OdometerPolicy.check(around.previousKm(), event.odometerKm(), around.nextKm());
        events.save(event);
        return event.id();
    }

    @Override
    @Transactional
    public boolean isConsistent(String vin, LocalDate date, int km) {
        Neighbours around = events.neighbours(vin, date, clock.instant(), UUID.randomUUID());
        try {
            OdometerPolicy.check(around.previousKm(), km, around.nextKm());
            return true;
        } catch (OdometerInconsistentException e) {
            return false;
        }
    }

    @Override
    @Transactional
    public List<EventView> history(String vin) {
        return events.allActive(vin).stream()
                .sorted(Comparator.comparing(VehicleEvent::date).thenComparing(e -> e.id().toString()))
                .map(EventService::toView).toList();
    }

    /**
     * Authorisation order: active owner (404), event exists (404), event has a document (404), event belongs to
     * the active period (403 document-restricted). Later owners see that a document exists but cannot open it.
     */
    @Override
    @Transactional
    public EventDocument get(UUID userId, String vin, UUID eventId) {
        UUID activePeriod = owners.assertActiveOwner(vin, userId);
        VehicleEvent event = events.findActive(vin, eventId)
                .orElseThrow(() -> new EventNotFoundException("Event " + eventId + " not found"));
        if (event.documentKey() == null) {
            throw new EventNotFoundException("Event " + eventId + " has no document");
        }
        if (!activePeriod.equals(event.periodId())) {
            throw new DocumentRestrictedException("The document is restricted to the owner who added it");
        }
        return documents.open(event.documentKey());
    }

    /**
     * Authorisation order: active owner (404), event exists (404), event belongs to the active period (403).
     * The timeline lock is taken after the owner check and before the read, so writes cannot use a stale read.
     */
    private VehicleEvent loadOwned(String vin, UUID userId, UUID eventId) {
        UUID activePeriod = owners.assertActiveOwner(vin, userId);
        events.lockTimeline(vin);
        VehicleEvent event = events.findActive(vin, eventId)
                .orElseThrow(() -> new EventNotFoundException("Event " + eventId + " not found"));
        if (!activePeriod.equals(event.periodId())) {
            throw new PriorPeriodEventException("Event was created during an earlier ownership period");
        }
        return event;
    }

    private static EventDetails toDomain(DetailsView d) {
        if (d == null) {
            return null;
        }
        List<PartLine> parts = d.parts() == null ? List.of()
                : d.parts().stream().map(p -> new PartLine(p.name(), p.qty(), p.price())).toList();
        return new EventDetails(d.serviceName(), parts, d.labor());
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
