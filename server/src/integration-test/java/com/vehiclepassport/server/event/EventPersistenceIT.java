package com.vehiclepassport.server.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.PartLine;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.VehicleEvent;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class EventPersistenceIT {

    private static final Instant T0 = Instant.parse("2025-06-01T10:00:00Z");
    /** Date, createdAt, then id as a string, which is the unsigned order Postgres uses for uuid. */
    private static final Comparator<VehicleEvent> ORDER = Comparator.comparing(VehicleEvent::date)
            .thenComparing(VehicleEvent::createdAt).thenComparing(e -> e.id().toString());

    @Inject
    EventRepositoryPort events;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AssertActiveOwnerUseCase owners;
    @Inject
    AddEventUseCase adding;

    private record Fixture(String vin, UUID owner, UUID period) {
    }

    private Fixture fixture() {
        String vin = EventTestVins.random();
        UUID owner = UUID.randomUUID();
        registering.register(new RegisterVehicleCommand(owner, vin, "Dacia", "Duster", null, 2020, "DIESEL"));
        return new Fixture(vin, owner, owners.assertActiveOwner(vin, owner).periodId());
    }

    private static VehicleEvent event(Fixture f, UUID id, String date, Instant createdAt, int km) {
        return new VehicleEvent(id, f.vin(), EventType.SERVICE, LocalDate.parse(date), km, new BigDecimal("10.50"),
                "RON", null, null, EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, f.owner(), f.period(), null,
                createdAt, null);
    }

    private void saveAll(List<VehicleEvent> toSave) {
        QuarkusTransaction.requiringNew().run(() -> toSave.forEach(events::save));
    }

    private List<VehicleEvent> page(String vin, TimelineCursor after, int limit) {
        return QuarkusTransaction.requiringNew().call(() -> events.page(vin, after, limit));
    }

    @Test
    void page_orders_by_date_createdAt_id() {
        Fixture f = fixture();
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID high = UUID.fromString("ffffffff-0000-0000-0000-000000000001");
        VehicleEvent late = event(f, UUID.randomUUID(), "2025-03-02", T0, 3000);
        VehicleEvent sameDayLater = event(f, UUID.randomUUID(), "2025-03-01", T0.plusSeconds(60), 2000);
        VehicleEvent tieHigh = event(f, high, "2025-03-01", T0, 1000);
        VehicleEvent tieLow = event(f, low, "2025-03-01", T0, 1000);
        saveAll(List.of(late, sameDayLater, tieHigh, tieLow));

        List<UUID> ids = page(f.vin(), null, 10).stream().map(VehicleEvent::id).toList();

        assertEquals(List.of(low, high, sameDayLater.id(), late.id()), ids);
    }

    @Test
    void page_with_cursor_continues_after() {
        Fixture f = fixture();
        List<VehicleEvent> all = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            all.add(event(f, UUID.randomUUID(), "2025-02-0" + (i + 1), T0, 1000 + i));
        }
        saveAll(all);
        VehicleEvent second = all.get(1);

        List<VehicleEvent> rest = page(f.vin(), new TimelineCursor(second.date(), second.createdAt(), second.id()), 10);

        assertEquals(all.subList(2, 5).stream().map(VehicleEvent::id).toList(),
                rest.stream().map(VehicleEvent::id).toList());
    }

    @Test
    void pagination_across_a_tie_loses_and_repeats_nothing() {
        Fixture f = fixture();
        List<VehicleEvent> all = new ArrayList<>();
        // eight events on one date: four share the exact createdAt, so only the id separates them
        for (int i = 0; i < 4; i++) {
            all.add(event(f, UUID.randomUUID(), "2025-04-10", T0, 5000));
        }
        for (int i = 0; i < 3; i++) {
            all.add(event(f, UUID.randomUUID(), "2025-04-10", T0.plusSeconds(i + 1), 5000));
        }
        all.add(event(f, UUID.randomUUID(), "2025-04-11", T0, 5000));
        saveAll(all);
        List<UUID> expected = all.stream().sorted(ORDER).map(VehicleEvent::id).toList();

        for (int size : new int[] {1, 2, 3}) {
            List<UUID> seen = new ArrayList<>();
            TimelineCursor cursor = null;
            while (true) {
                List<VehicleEvent> fetched = page(f.vin(), cursor, size);
                fetched.forEach(e -> seen.add(e.id()));
                if (fetched.size() < size) {
                    break;
                }
                VehicleEvent last = fetched.get(fetched.size() - 1);
                cursor = new TimelineCursor(last.date(), last.createdAt(), last.id());
            }
            assertEquals(expected, seen, "page size " + size);
        }
    }

    @Test
    void neighbours_skip_deleted_and_excluded() {
        Fixture f = fixture();
        VehicleEvent before = event(f, UUID.randomUUID(), "2025-01-01", T0, 1000);
        VehicleEvent deleted = event(f, UUID.randomUUID(), "2025-02-01", T0, 1500).deleted(T0.plusSeconds(5));
        VehicleEvent self = event(f, UUID.randomUUID(), "2025-03-01", T0, 2000);
        VehicleEvent after = event(f, UUID.randomUUID(), "2025-04-01", T0, 3000);
        saveAll(List.of(before, deleted, self, after));

        Neighbours around = QuarkusTransaction.requiringNew()
                .call(() -> events.neighbours(f.vin(), self.date(), self.createdAt(), self.id()));
        assertEquals(new Neighbours(1000, 3000), around);

        Neighbours edge = QuarkusTransaction.requiringNew()
                .call(() -> events.neighbours(f.vin(), LocalDate.parse("2024-12-01"), T0, UUID.randomUUID()));
        assertNull(edge.previousKm());
        assertEquals(1000, edge.nextKm());
        assertTrue(QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), deleted.id())).isEmpty());
        assertEquals(3, QuarkusTransaction.requiringNew().call(() -> events.allActive(f.vin())).size());
    }

    @Test
    void details_json_round_trips() {
        Fixture f = fixture();
        EventDetails details = new EventDetails("Service Auto și țiri",
                List.of(new PartLine("Filtru ulei", new BigDecimal("2"), new BigDecimal("45.50")),
                        new PartLine("Ulei \"5W-30\"", new BigDecimal("4.5"), new BigDecimal("30.00"))),
                new BigDecimal("120.00"));
        VehicleEvent documented = new VehicleEvent(UUID.randomUUID(), f.vin(), EventType.SERVICE,
                LocalDate.parse("2025-05-05"), 7000, new BigDecimal("450.00"), "RON", "scan",
                details, EvidenceLevel.DOCUMENTED, EventSource.SCAN, f.owner(), f.period(), "docs/k.pdf", T0, null);
        VehicleEvent plain = event(f, UUID.randomUUID(), "2025-05-06", T0, 7100);
        saveAll(List.of(documented, plain));

        VehicleEvent loaded = QuarkusTransaction.requiringNew()
                .call(() -> events.findActive(f.vin(), documented.id())).orElseThrow();

        assertEquals(documented, loaded);
        assertEquals(new BigDecimal("45.50"), loaded.details().parts().get(0).price());
        assertNull(QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), plain.id()))
                .orElseThrow().details());
    }

    @Test
    void notes_with_quotes_newlines_emoji_and_diacritics_round_trip() {
        Fixture f = fixture();
        String notes = Notes.TRICKY;
        VehicleEvent e = new VehicleEvent(UUID.randomUUID(), f.vin(), EventType.REPAIR, LocalDate.parse("2025-05-05"),
                7000, new BigDecimal("1.00"), "RON", notes, null, EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL,
                f.owner(), f.period(), null, T0, null);
        saveAll(List.of(e));

        assertEquals(notes, QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), e.id()))
                .orElseThrow().notes());
    }

    @Test
    void concurrent_adds_cannot_break_monotonicity() throws Exception {
        for (int round = 0; round < 3; round++) {
            Fixture f = fixture();
            // the later date has the lower km: whichever lands second contradicts the first
            List<Callable<Object>> adds = List.of(add(f, "2025-01-01", 50000), add(f, "2025-02-01", 40000));
            CountDownLatch start = new CountDownLatch(1);
            ExecutorService pool = Executors.newFixedThreadPool(2);
            try {
                List<Future<Object>> futures = new ArrayList<>();
                for (Callable<Object> c : adds) {
                    futures.add(pool.submit(() -> {
                        start.await();
                        return c.call();
                    }));
                }
                start.countDown();
                int succeeded = 0;
                for (Future<Object> future : futures) {
                    try {
                        future.get();
                        succeeded++;
                    } catch (ExecutionException e) {
                        assertEquals("odometer-inconsistent", ((DomainException) e.getCause()).code());
                    }
                }
                assertEquals(1, succeeded, "exactly one of two contradictory adds succeeds");
            } finally {
                pool.shutdownNow();
            }
            assertEquals(1, QuarkusTransaction.requiringNew().call(() -> events.allActive(f.vin())).size());
        }
    }

    private Callable<Object> add(Fixture f, String date, int km) {
        return () -> adding.add(new AddEventCommand(f.owner(), f.vin(), "SERVICE", LocalDate.parse(date), km,
                BigDecimal.TEN, "RON", null));
    }
}
