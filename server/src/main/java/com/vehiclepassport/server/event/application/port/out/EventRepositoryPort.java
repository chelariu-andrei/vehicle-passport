package com.vehiclepassport.server.event.application.port.out;

import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Order is always (date, createdAt, id); soft-deleted events are ignored. */
public interface EventRepositoryPort {

    void lockTimeline(String vin);

    Optional<VehicleEvent> findActive(String vin, UUID id);

    Neighbours neighbours(String vin, LocalDate date, Instant createdAt, UUID excludeId);

    void save(VehicleEvent event);

    /** Events strictly after the cursor (from the start when null), at most limit. */
    List<VehicleEvent> page(String vin, TimelineCursor after, int limit);

    List<VehicleEvent> allActive(String vin);
}
