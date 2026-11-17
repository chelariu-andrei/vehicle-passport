package com.vehiclepassport.server.event.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.DeadlineItemView;
import com.vehiclepassport.server.event.application.port.in.DeadlinesView;
import com.vehiclepassport.server.event.application.port.out.ActiveOwnerPort;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.application.port.out.OwnedPeriod;
import com.vehiclepassport.server.event.domain.model.EventFilter;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import com.vehiclepassport.server.event.domain.model.TimelineSummary;
import com.vehiclepassport.server.event.domain.model.Validity;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeadlinesServiceTest {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final UUID USER = UUID.randomUUID();
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-16T23:30:00Z"), ZoneOffset.UTC);

    private final List<String> reads = new ArrayList<>();
    private List<VehicleEvent> stored = List.of();

    private final EventRepositoryPort repo = new EventRepositoryPort() {
        public void lockTimeline(String vin) { }
        public Optional<VehicleEvent> findActive(String vin, UUID id) { return Optional.empty(); }
        public Neighbours neighbours(String vin, LocalDate d, Instant c, UUID x) { return null; }
        public void save(VehicleEvent e) { }
        public List<VehicleEvent> page(String vin, EventFilter f, TimelineOrder o, TimelineCursor a, int l) {
            return List.of();
        }
        public TimelineSummary summary(String vin, EventFilter f) { return null; }
        public List<VehicleEvent> allActive(String vin) { throw new AssertionError("no other query"); }
        public List<VehicleEvent> validityEntries(String vin) {
            reads.add(vin);
            return stored;
        }
        public long countActiveByCreator(UUID userId) { return 0; }
        public List<VehicleEvent> activeByCreator(UUID userId) { return List.of(); }
        public void detachCreator(UUID userId, UUID tombstone) { }
    };

    private static VehicleEvent rca(String from, String until) {
        return new VehicleEvent(UUID.randomUUID(), VIN, EventType.INSURANCE, LocalDate.parse(from), null,
                BigDecimal.TEN, "RON", null, null, new Validity(LocalDate.parse(from), LocalDate.parse(until)),
                new InsuranceDetails(InsuranceCoverage.RCA, "Allianz", null), Set.of(), List.of(),
                EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, USER, UUID.randomUUID(), null,
                Instant.parse("2026-01-01T00:00:00Z"), null);
    }

    @Test
    void readsTheCanonicalVinAndRatesAgainstTheClockDay() {
        VehicleEvent rca = rca("2026-01-01", "2026-12-16");
        stored = List.of(rca);
        ActiveOwnerPort owners = (vin, user) -> new OwnedPeriod(VIN, UUID.randomUUID());
        DeadlinesService service = new DeadlinesService(repo, owners, CLOCK);

        DeadlinesView view = service.get(USER, VIN.toLowerCase());

        assertEquals(List.of(VIN), reads);
        assertEquals(List.of("ITP", "RCA", "CASCO", "ROVINIETA", "FIRE_EXTINGUISHER", "FIRST_AID_KIT"),
                view.items().stream().map(DeadlineItemView::kind).toList());
        DeadlineItemView item = view.items().get(1);
        assertEquals("EXPIRING", item.status());
        assertEquals(30, item.daysLeft());
        assertEquals(LocalDate.parse("2026-12-16"), item.validUntil());
        assertEquals(rca.id(), item.eventId());
        DeadlineItemView itp = view.items().get(0);
        assertEquals("NOT_RECORDED", itp.status());
        assertNull(itp.eventId());
    }

    @Test
    void notTheActiveOwnerReadsNothing() {
        RuntimeException refused = new RuntimeException("vehicle-not-found");
        ActiveOwnerPort owners = (vin, user) -> {
            throw refused;
        };
        DeadlinesService service = new DeadlinesService(repo, owners, CLOCK);

        assertSame(refused, assertThrows(RuntimeException.class, () -> service.get(USER, VIN)));
        assertTrue(reads.isEmpty());
    }
}
