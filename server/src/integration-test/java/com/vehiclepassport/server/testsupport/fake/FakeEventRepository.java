package com.vehiclepassport.server.testsupport.fake;

import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.testsupport.Resettable;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

@Alternative
@ApplicationScoped
public class FakeEventRepository implements EventRepositoryPort, Resettable {

    private static final Comparator<VehicleEvent> ORDER = Comparator
        .comparing(VehicleEvent::date)
        .thenComparing(VehicleEvent::createdAt)
        .thenComparing(VehicleEvent::id);

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
        List<VehicleEvent> others = active(vin).filter(e -> !e.id().equals(excludeId)).sorted(ORDER).toList();
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
    public List<VehicleEvent> page(String vin, TimelineCursor after, int limit) {
        return active(vin).sorted(ORDER)
            .filter(e -> after == null || ORDER.compare(e, cursorEvent(after)) > 0)
            .limit(limit)
            .toList();
    }

    @Override
    public List<VehicleEvent> allActive(String vin) {
        return active(vin).sorted(ORDER).toList();
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
            null, c.createdAt(), null);
    }
}
