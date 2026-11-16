package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.CheckOdometerUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import com.vehiclepassport.server.event.application.port.in.UpdateEventUseCase;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.event.domain.exception.OdometerInconsistentException;
import com.vehiclepassport.server.event.domain.exception.PriorPeriodEventException;
import com.vehiclepassport.server.event.domain.model.Attachment;
import com.vehiclepassport.server.event.domain.model.AttachmentKind;
import com.vehiclepassport.server.event.domain.model.PartLine;
import java.time.LocalDate;
import com.vehiclepassport.server.event.application.port.in.DetailsView;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.PartView;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.AttachmentRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.OwnedPeriod;
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
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class EventService implements AddEventUseCase, GetTimelineUseCase, UpdateEventUseCase, DeleteEventUseCase,
        SaveConfirmedEventUseCase, CheckOdometerUseCase, ReadVehicleHistoryUseCase {

    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 100;

    private final EventRepositoryPort events;
    private final ActiveOwnerPort owners;
    private final AttachmentRepositoryPort attachments;
    private final Clock clock;

    @Inject
    public EventService(EventRepositoryPort events, ActiveOwnerPort owners, AttachmentRepositoryPort attachments,
            Clock clock) {
        this.events = events;
        this.owners = owners;
        this.attachments = attachments;
        this.clock = clock;
    }

    @Override
    @Transactional
    public EventView add(AddEventCommand c) {
        OwnedPeriod owned = owners.assertActiveOwner(c.vin(), c.userId());
        UUID periodId = owned.periodId();
        VehicleEvent event = VehicleEvent.manual(owned.vin(), EventType.parse(c.type()), c.date(), c.odometerKm(),
                c.costAmount(), c.currency(), c.notes(), c.userId(), periodId, clock);
        events.lockTimeline(event.vin());
        Neighbours around = events.neighbours(event.vin(), event.date(), event.createdAt(), event.id());
        OdometerPolicy.check(around.previousKm(), event.odometerKm(), around.nextKm());
        events.save(event);
        return toView(event, 0);
    }

    @Override
    @Transactional
    public TimelinePage get(UUID userId, String vin, String cursor, int limit) {
        String canonical = owners.assertActiveOwner(vin, userId).vin();
        int size = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
        TimelineCursor after = cursor == null || cursor.isBlank() ? null : TimelineCursor.decode(cursor);
        List<VehicleEvent> fetched = events.page(canonical, after, size + 1);
        boolean more = fetched.size() > size;
        List<VehicleEvent> window = more ? fetched.subList(0, size) : fetched;
        String next = null;
        if (more) {
            VehicleEvent last = window.get(window.size() - 1);
            next = new TimelineCursor(last.date(), last.createdAt(), last.id()).encode();
        }
        return new TimelinePage(toViews(window), next);
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
        return toView(edited, attachments.countLive(edited.id()));
    }

    @Override
    @Transactional
    public void delete(UUID userId, String vin, UUID eventId) {
        VehicleEvent current = loadOwned(vin, userId, eventId);
        Instant now = clock.instant();
        events.save(current.deleted(now));
        // The attachments go with the event, which frees their hashes for re-upload elsewhere.
        attachments.softDeleteAllFor(current.id(), now);
    }

    @Override
    @Transactional
    public UUID save(SaveConfirmedEventCommand c) {
        OwnedPeriod owned = owners.assertActiveOwner(c.vin(), c.userId());
        UUID periodId = owned.periodId();
        VehicleEvent event = VehicleEvent.documented(owned.vin(), EventType.parse(c.type()), c.date(), c.odometerKm(),
                c.total(), c.currency(), c.notes(), toDomain(c.details()), c.userId(), periodId, clock);
        events.lockTimeline(event.vin());
        Neighbours around = events.neighbours(event.vin(), event.date(), event.createdAt(), event.id());
        OdometerPolicy.check(around.previousKm(), event.odometerKm(), around.nextKm());
        events.save(event);
        // The scanned file stays with the event as its protected source document. Scan sources are exempt from
        // the duplicate rule (spec: scan submit does not deduplicate in v1).
        attachments.save(new Attachment(UUID.randomUUID(), event.id(), event.vin(), c.sha256(), c.contentType(),
                c.sizeBytes(), c.documentKey(), AttachmentKind.SCAN_SOURCE, c.userId(), event.createdAt(), null));
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
        return toViews(events.allActive(vin).stream()
                .sorted(Comparator.comparing(VehicleEvent::date).thenComparing(e -> e.id().toString())).toList());
    }

    /**
     * Authorisation order: active owner (404), event exists (404), event belongs to the active period (403).
     * The timeline lock is taken after the owner check and before the read, so writes cannot use a stale read.
     */
    private VehicleEvent loadOwned(String vin, UUID userId, UUID eventId) {
        OwnedPeriod owned = owners.assertActiveOwner(vin, userId);
        UUID activePeriod = owned.periodId();
        events.lockTimeline(owned.vin());
        VehicleEvent event = events.findActive(owned.vin(), eventId)
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

    private List<EventView> toViews(List<VehicleEvent> list) {
        Map<UUID, Integer> counts = attachments.countsFor(list.stream().map(VehicleEvent::id).toList());
        return list.stream().map(e -> toView(e, counts.getOrDefault(e.id(), 0))).toList();
    }

    /** Attachments never change evidence; they only mark that a document is present. */
    private static EventView toView(VehicleEvent e, int attachmentCount) {
        return new EventView(e.id(), e.type().name(), e.date(), e.odometerKm(), e.costAmount(), e.currency(),
                e.notes(), toView(e.details()), e.evidence().name(), e.source().name(), attachmentCount > 0,
                attachmentCount);
    }

    private static DetailsView toView(EventDetails d) {
        if (d == null) {
            return null;
        }
        return new DetailsView(d.serviceName(),
                d.parts().stream().map(p -> new PartView(p.name(), p.qty(), p.price())).toList(), d.labor());
    }
}
