package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.EventFilter;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

@Alternative
@ApplicationScoped
public class FakeEventRepository implements EventRepositoryPort, Resettable {

    private static final Comparator<VehicleEvent> ORDER = Comparator
        .comparing(VehicleEvent::date)
        .thenComparing(VehicleEvent::createdAt)
        .thenComparing(VehicleEvent::id);

    private static final Set<EventType> VALIDITY_TYPES =
        EnumSet.of(EventType.ROVINIETA, EventType.INSURANCE, EventType.ITP, EventType.SAFETY_EQUIPMENT);

    private final List<VehicleEvent> store = new ArrayList<>();

    @Override
    public void lockTimeline(String vin) {
        // single-threaded in tests
    }

    @Override
    public Optional<VehicleEvent> findActive(String vin, UUID id) {
        return active(vin).filter(e -> e.id().equals(id)).findFirst();
    }

    @Override
    public Neighbours neighbours(String vin, LocalDate date, Instant createdAt, UUID excludeId) {
        // Like the real repository, events without a reading are no neighbours.
        List<VehicleEvent> others = active(vin).filter(e -> !e.id().equals(excludeId) && e.odometerKm() != null)
            .sorted(ORDER).toList();
        Integer previous = null;
        Integer next = null;
        for (VehicleEvent e : others) {
            if (isAtOrBefore(e, date, createdAt)) {
                previous = e.odometerKm();
            } else if (next == null) {
                next = e.odometerKm();
            }
        }
        return new Neighbours(previous, next);
    }

    @Override
    public void save(VehicleEvent event) {
        store.removeIf(e -> e.id().equals(event.id()));
        store.add(event);
    }

    @Override
    public List<VehicleEvent> page(String vin, EventFilter filter, TimelineOrder order, TimelineCursor after,
            int limit) {
        Comparator<VehicleEvent> direction = order == TimelineOrder.DESC ? ORDER.reversed() : ORDER;
        return active(vin).filter(e -> matches(e, filter)).sorted(direction)
            .filter(e -> after == null || direction.compare(e, cursorEvent(after)) > 0)
            .limit(limit)
            .toList();
    }

    private static boolean matches(VehicleEvent e, EventFilter f) {
        return (f.types().isEmpty() || f.types().contains(e.type()))
            && (f.components().isEmpty() || e.components().stream().anyMatch(f.components()::contains))
            && (f.from() == null || !e.date().isBefore(f.from()))
            && (f.to() == null || !e.date().isAfter(f.to()));
    }

    @Override
    public List<VehicleEvent> allActive(String vin) {
        return active(vin).sorted(ORDER).toList();
    }

    @Override
    public List<VehicleEvent> validityEntries(String vin) {
        return active(vin).filter(e -> VALIDITY_TYPES.contains(e.type())).sorted(ORDER).toList();
    }

    @Override
    public long countActiveByCreator(UUID userId) {
        return store.stream().filter(e -> e.deletedAt() == null && e.createdBy().equals(userId)).count();
    }

    @Override
    public List<VehicleEvent> activeByCreator(UUID userId) {
        return store.stream().filter(e -> e.deletedAt() == null && e.createdBy().equals(userId))
            .sorted(Comparator.comparing(VehicleEvent::vin).thenComparing(ORDER)).toList();
    }

    @Override
    public void reset() {
        store.clear();
    }

    private Stream<VehicleEvent> active(String vin) {
        return store.stream().filter(e -> e.vin().equals(vin) && e.deletedAt() == null);
    }

    private static boolean isAtOrBefore(VehicleEvent e, LocalDate date, Instant createdAt) {
        int byDate = e.date().compareTo(date);
        return byDate < 0 || (byDate == 0 && e.createdAt().compareTo(createdAt) <= 0);
    }

    private static VehicleEvent cursorEvent(TimelineCursor c) {
        return new VehicleEvent(c.id(), null, null, c.date(), 0, null, null, null, null, null, null, null, null,
            null, null, null, null, null, c.createdAt(), null);
    }

    /** Not exercised through fakes: the purge runs against real persistence in AccountPurgeIT. */
    @Override
    public void detachCreator(UUID userId, UUID tombstone) {
    }
}
