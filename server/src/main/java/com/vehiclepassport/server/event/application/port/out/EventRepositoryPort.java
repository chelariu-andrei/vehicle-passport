package com.vehiclepassport.server.event.application.port.out;

import com.vehiclepassport.server.event.domain.model.EventFilter;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Order is always (date, createdAt, id), ascending unless stated; soft-deleted events are ignored. */
public interface EventRepositoryPort {

    void lockTimeline(String vin);

    Optional<VehicleEvent> findActive(String vin, UUID id);

    Neighbours neighbours(String vin, LocalDate date, Instant createdAt, UUID excludeId);

    void save(VehicleEvent event);

    /**
     * Events matching the filter, in the given direction over (date, createdAt, id), strictly after the cursor in
     * that direction (from the start when null), at most limit. The cursor must have been issued for that order.
     */
    List<VehicleEvent> page(String vin, EventFilter filter, TimelineOrder order, TimelineCursor after, int limit);

    List<VehicleEvent> allActive(String vin);

    /** Non-deleted events recorded by the given user. */
    long countActiveByCreator(UUID userId);

    /** Non-deleted events recorded by the given user, ordered by vin then the timeline order. */
    List<VehicleEvent> activeByCreator(UUID userId);

    /** Points every event recorded by the user at {@code tombstone}. Safe to repeat. */
    void detachCreator(UUID userId, UUID tombstone);
}
