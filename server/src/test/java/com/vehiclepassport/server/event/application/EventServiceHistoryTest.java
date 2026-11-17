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
import com.vehiclepassport.server.event.domain.model.EventFilter;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EventServiceHistoryTest {

    private static final String VIN = "WVWZZZ1JZXW000001";

    private static VehicleEvent event(UUID id, String createdAt) {
        return event(id, createdAt, 1000);
    }

    private static VehicleEvent event(UUID id, String createdAt, Integer km) {
        return new VehicleEvent(id, VIN, EventType.SERVICE, LocalDate.parse("2025-03-01"), km, BigDecimal.TEN,
                "RON", null, null, null, null, Set.of(), List.of(), EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, UUID.randomUUID(),
                UUID.randomUUID(), null, Instant.parse(createdAt), null);
    }

    @Test
    void history_is_sorted_by_date_then_id_regardless_of_creation_order() {
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID high = UUID.fromString("ffffffff-0000-0000-0000-000000000001");
        // repository order is (date, createdAt, id): the higher id was created first
        List<VehicleEvent> stored = List.of(event(high, "2025-03-02T00:00:00Z"), event(low, "2025-03-03T00:00:00Z"));
        assertEquals(List.of(low, high), serviceOver(stored).history(VIN).stream().map(EventView::id).toList());
    }

    @Test
    void latest_km_is_the_highest_reading_and_empty_without_one() {
        assertEquals(Optional.empty(), serviceOver(List.of()).latestKm(VIN));
        assertEquals(Optional.empty(),
                serviceOver(List.of(event(UUID.randomUUID(), "2025-03-02T00:00:00Z", null))).latestKm(VIN));
        List<VehicleEvent> stored = List.of(event(UUID.randomUUID(), "2025-03-02T00:00:00Z", 12000),
                event(UUID.randomUUID(), "2025-03-03T00:00:00Z", null),
                event(UUID.randomUUID(), "2025-03-04T00:00:00Z", 9000));
        assertEquals(Optional.of(12000), serviceOver(stored).latestKm(VIN));
    }

    private static EventService serviceOver(List<VehicleEvent> stored) {
        EventRepositoryPort repo = new EventRepositoryPort() {
            public void lockTimeline(String vin) { }
            public Optional<VehicleEvent> findActive(String vin, UUID id) { return Optional.empty(); }
            public Neighbours neighbours(String vin, LocalDate d, Instant c, UUID x) { return null; }
            public void save(VehicleEvent e) { }
            public List<VehicleEvent> page(String vin, EventFilter f, TimelineOrder o, TimelineCursor a, int l) { return List.of(); }
            public List<VehicleEvent> allActive(String vin) { return stored; }
            public List<VehicleEvent> validityEntries(String vin) { return List.of(); }
            public com.vehiclepassport.server.event.domain.model.TimelineSummary summary(String vin, EventFilter f) { return null; }
            public long countActiveByCreator(UUID userId) { return 0; }
            public List<VehicleEvent> activeByCreator(UUID userId) { return List.of(); }
            public void detachCreator(UUID userId, UUID tombstone) { }
        };
        ActiveOwnerPort owners = (vin, user) -> new com.vehiclepassport.server.event.application.port.out.OwnedPeriod(vin, UUID.randomUUID());
        return new EventService(repo, owners, new AttachmentServiceTest.FakeAttachments(),
                Clock.fixed(Instant.parse("2026-01-15T10:00:00Z"), ZoneOffset.UTC));
    }
}
