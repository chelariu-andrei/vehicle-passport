package com.vehiclepassport.server.event.application.service;

import com.vehiclepassport.server.event.application.port.in.DetachOwnerUseCase;
import com.vehiclepassport.server.event.application.port.in.ListEventsByCreatorUseCase;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.CheckOdometerUseCase;
import com.vehiclepassport.server.event.application.port.in.CountOwnedByOwnerUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import com.vehiclepassport.server.event.application.port.in.UpdateEventUseCase;
import com.vehiclepassport.server.event.application.port.in.CustomFieldView;
import com.vehiclepassport.server.event.domain.exception.EventNotFoundException;
import com.vehiclepassport.server.event.domain.exception.InvalidEventException;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpResult;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.Validity;
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
import com.vehiclepassport.server.event.domain.model.EventAnnotations;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventFacts;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.ScanDetails;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
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
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class EventService implements AddEventUseCase, GetTimelineUseCase, UpdateEventUseCase, DeleteEventUseCase,
        SaveConfirmedEventUseCase, CheckOdometerUseCase, ReadVehicleHistoryUseCase, CountOwnedByOwnerUseCase,
        DetachOwnerUseCase, ListEventsByCreatorUseCase {

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
    public void detach(UUID ownerId, UUID tombstone) {
        events.detachCreator(ownerId, tombstone);
        attachments.detachCreator(ownerId, tombstone);
    }

    @Override
    public long count(UUID ownerId) {
        return events.countActiveByCreator(ownerId);
    }

    @Override
    @Transactional
    public List<CreatedEventView> listByCreator(UUID userId) {
        List<VehicleEvent> created = events.activeByCreator(userId);
        List<EventView> views = toViews(created);
        return java.util.stream.IntStream.range(0, created.size())
                .mapToObj(i -> new CreatedEventView(created.get(i).vin(), views.get(i))).toList();
    }

    @Override
    @Transactional
    public EventView add(AddEventCommand c) {
        OwnedPeriod owned = owners.assertActiveOwner(c.vin(), c.userId());
        UUID periodId = owned.periodId();
        VehicleEvent event = VehicleEvent.manual(owned.vin(), EventInputService.facts(c.input()),
                EventInputService.annotations(c.input()), c.userId(), periodId, clock);
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
        TimelineCursor after = cursor == null || cursor.isBlank() ? null : TimelineCursor.decode(cursor, TimelineOrder.ASC);
        List<VehicleEvent> fetched = events.page(canonical, after, size + 1);
        boolean more = fetched.size() > size;
        List<VehicleEvent> window = more ? fetched.subList(0, size) : fetched;
        String next = null;
        if (more) {
            VehicleEvent last = window.get(window.size() - 1);
            next = new TimelineCursor(TimelineOrder.ASC, last.date(), last.createdAt(), last.id()).encode();
        }
        return new TimelinePage(toViews(window), next);
    }

    @Override
    @Transactional
    public EventView update(UpdateEventCommand c) {
        VehicleEvent current = loadOwned(c.vin(), c.userId(), c.eventId());
        EventFacts stated = EventInputService.facts(c.input());
        // Scan details are read-only and a client never sends them back: an edit without details keeps them.
        EventFacts facts = stated.details() == null && current.details() instanceof ScanDetails
                && stated.type() == current.type()
                ? new EventFacts(stated.type(), stated.date(), stated.odometerKm(), stated.costAmount(),
                        stated.currency(), stated.customLabel(), stated.validFrom(), stated.validUntil(),
                        current.details())
                : stated;
        VehicleEvent edited = current.edited(facts, EventInputService.annotations(c.input()), clock);
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
        EventType type = EventType.parse(c.type());
        if (type != EventType.ITP && (c.validUntil() != null || c.itpResult() != null)) {
            throw InvalidEventException.validation("Valid until and ITP result are only allowed for an ITP");
        }
        EventFacts facts = new EventFacts(type, c.date(), c.odometerKm(), c.total(), c.currency(), null, null,
                c.validUntil(), scanned(type, c.details(), c.itpResult()));
        VehicleEvent event = VehicleEvent.documented(owned.vin(), facts,
                new EventAnnotations(c.notes(), Set.of(), List.of()), c.userId(), periodId, clock);
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
    public boolean isConsistent(String vin, LocalDate date, Integer km) {
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

    /**
     * A scanned ITP keeps only the station, read from the reviewed service name, and the result; other types keep
     * the scan.
     */
    private static EventDetails scanned(EventType type, DetailsView d, String itpResult) {
        if (type == EventType.ITP) {
            return new ItpDetails(d == null ? null : d.serviceName(),
                    itpResult == null ? null : EventInputService.parse(ItpResult.class, itpResult, "ITP result"));
        }
        if (d == null) {
            return null;
        }
        List<PartLine> parts = d.parts() == null ? List.of()
                : d.parts().stream().map(p -> new PartLine(p.name(), p.qty(), p.price())).toList();
        return new ScanDetails(d.serviceName(), parts, d.labor());
    }

    private List<EventView> toViews(List<VehicleEvent> list) {
        Map<UUID, Integer> counts = attachments.countsFor(list.stream().map(VehicleEvent::id).toList());
        return list.stream().map(e -> toView(e, counts.getOrDefault(e.id(), 0))).toList();
    }

    /**
     * Attachments never change evidence; they only mark that a document is present. validityStatus stays null
     * until the status policy exists.
     */
    private static EventView toView(VehicleEvent e, int attachmentCount) {
        Validity v = e.validity();
        return new EventView(e.id(), e.type().name(), e.date(), e.odometerKm(), e.costAmount(), e.currency(),
                e.notes(), e.customLabel(), v == null ? null : v.validFrom(), v == null ? null : v.validUntil(),
                toView(e.details()), e.components().stream().map(Component::name).toList(),
                e.customFields().stream().map(f -> new CustomFieldView(f.label(), f.value())).toList(), null,
                e.evidence().name(), e.source().name(), attachmentCount > 0, attachmentCount);
    }

    /** Old scanned ITP rows still hold scan details; they are shown as SCAN, like any scan. */
    private static DetailsView toView(EventDetails d) {
        if (d == null) {
            return null;
        }
        return switch (d) {
            case ScanDetails s -> DetailsView.scan(s.serviceName(),
                    s.parts().stream().map(p -> new PartView(p.name(), p.qty(), p.price())).toList(), s.labor());
            case InsuranceDetails i -> new DetailsView(i.kind().name(), null, null, null, i.coverage().name(),
                    i.insurer(), i.policyNumber(), null, null, null, null);
            case RovinietaDetails r -> new DetailsView(r.kind().name(), null, null, null, null, null, null,
                    r.duration().name(), null, null, null);
            case ItpDetails i -> new DetailsView(i.kind().name(), null, null, null, null, null, null, null,
                    i.station(), i.result() == null ? null : i.result().name(), null);
            case SafetyEquipmentDetails s -> new DetailsView(s.kind().name(), null, null, null, null, null, null,
                    null, null, null, s.item().name());
        };
    }
}
