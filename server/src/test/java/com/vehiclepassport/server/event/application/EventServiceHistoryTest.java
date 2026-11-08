package com.vehiclepassport.server.event.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.application.service.EventService;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EventServiceHistoryTest {

    private static final String VIN = "WVWZZZ1JZXW000001";

    private static VehicleEvent event(UUID id, String createdAt) {
        return new VehicleEvent(id, VIN, EventType.SERVICE, LocalDate.parse("2025-03-01"), 1000, BigDecimal.TEN,
                "RON", null, null, EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, UUID.randomUUID(),
                UUID.randomUUID(), null, Instant.parse(createdAt), null);
    }

    @Test
    void history_is_sorted_by_date_then_id_regardless_of_creation_order() {
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID high = UUID.fromString("ffffffff-0000-0000-0000-000000000001");
        // repository order is (date, createdAt, id): the higher id was created first
        List<VehicleEvent> stored = List.of(event(high, "2025-03-02T00:00:00Z"), event(low, "2025-03-03T00:00:00Z"));
        EventRepositoryPort repo = new EventRepositoryPort() {
            public void lockTimeline(String vin) { }
            public Optional<VehicleEvent> findActive(String vin, UUID id) { return Optional.empty(); }
            public Neighbours neighbours(String vin, LocalDate d, Instant c, UUID x) { return null; }
            public void save(VehicleEvent e) { }
            public List<VehicleEvent> page(String vin, TimelineCursor a, int l) { return List.of(); }
            public List<VehicleEvent> allActive(String vin) { return stored; }
        };
        ActiveOwnerPort owners = (vin, user) -> UUID.randomUUID();
        EventService service = new EventService(repo, owners, Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"),
                ZoneOffset.UTC));
        assertEquals(List.of(low, high), service.history(VIN).stream().map(EventView::id).toList());
    }
}
