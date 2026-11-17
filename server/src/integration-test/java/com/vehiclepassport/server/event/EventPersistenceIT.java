package com.vehiclepassport.server.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.event.application.port.out.EventRepositoryPort;
import com.vehiclepassport.server.event.domain.model.Component;
import com.vehiclepassport.server.event.domain.model.CustomField;
import com.vehiclepassport.server.event.domain.model.EventAnnotations;
import com.vehiclepassport.server.event.domain.model.EventDetails;
import com.vehiclepassport.server.event.domain.model.EventSource;
import com.vehiclepassport.server.event.domain.model.EventType;
import com.vehiclepassport.server.event.domain.model.EvidenceLevel;
import com.vehiclepassport.server.event.domain.model.InsuranceCoverage;
import com.vehiclepassport.server.event.domain.model.InsuranceDetails;
import com.vehiclepassport.server.event.domain.model.ItpDetails;
import com.vehiclepassport.server.event.domain.model.ItpResult;
import com.vehiclepassport.server.event.domain.model.Neighbours;
import com.vehiclepassport.server.event.domain.model.PartLine;
import com.vehiclepassport.server.event.domain.model.RovinietaDetails;
import com.vehiclepassport.server.event.domain.model.RovinietaDuration;
import com.vehiclepassport.server.event.domain.model.SafetyEquipmentDetails;
import com.vehiclepassport.server.event.domain.model.SafetyItem;
import com.vehiclepassport.server.event.domain.model.ScanDetails;
import com.vehiclepassport.server.event.domain.model.TimelineCursor;
import com.vehiclepassport.server.event.domain.model.TimelineOrder;
import com.vehiclepassport.server.event.domain.model.Validity;
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
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
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
    @Inject
    EntityManager em;

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
                "RON", null, null, null, null, Set.of(), List.of(), EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL,
                f.owner(), f.period(), null, createdAt, null);
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

        List<VehicleEvent> rest = page(f.vin(), new TimelineCursor(TimelineOrder.ASC, second.date(), second.createdAt(), second.id()), 10);

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
                cursor = new TimelineCursor(TimelineOrder.ASC, last.date(), last.createdAt(), last.id());
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
        EventDetails details = new ScanDetails("Service Auto și țiri",
                List.of(new PartLine("Filtru ulei", new BigDecimal("2"), new BigDecimal("45.50")),
                        new PartLine("Ulei \"5W-30\"", new BigDecimal("4.5"), new BigDecimal("30.00"))),
                new BigDecimal("120.00"));
        VehicleEvent documented = new VehicleEvent(UUID.randomUUID(), f.vin(), EventType.SERVICE,
                LocalDate.parse("2025-05-05"), 7000, new BigDecimal("450.00"), "RON", null, "scan", null,
                details, Set.of(), List.of(), EvidenceLevel.DOCUMENTED, EventSource.SCAN, f.owner(), f.period(), "docs/k.pdf", T0, null);
        VehicleEvent plain = event(f, UUID.randomUUID(), "2025-05-06", T0, 7100);
        saveAll(List.of(documented, plain));

        VehicleEvent loaded = QuarkusTransaction.requiringNew()
                .call(() -> events.findActive(f.vin(), documented.id())).orElseThrow();

        assertEquals(documented, loaded);
        assertEquals(new BigDecimal("45.50"), ((ScanDetails) loaded.details()).parts().get(0).price());
        assertNull(QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), plain.id()))
                .orElseThrow().details());
    }

    @Test
    void notes_with_quotes_newlines_emoji_and_diacritics_round_trip() {
        Fixture f = fixture();
        String notes = Notes.TRICKY;
        VehicleEvent e = new VehicleEvent(UUID.randomUUID(), f.vin(), EventType.REPAIR, LocalDate.parse("2025-05-05"),
                7000, new BigDecimal("1.00"), "RON", null, notes, null, null, Set.of(), List.of(),
                EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL,
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

    private VehicleEvent full(Fixture f, EventType type, String date, Integer km, String label, Validity validity,
            EventDetails details, EvidenceLevel evidence, EventSource source) {
        return new VehicleEvent(UUID.randomUUID(), f.vin(), type, LocalDate.parse(date), km, new BigDecimal("99.90"),
                "EUR", label, "notes " + type, validity, details, Set.of(Component.BRAKES, Component.ENGINE),
                List.of(new CustomField("Mecanic", "Ion"), new CustomField("Garanție", "12 luni")), evidence, source,
                f.owner(), f.period(), null, T0, null);
    }

    @Test
    void roundTripsEveryNewField() {
        Fixture f = fixture();
        ScanDetails scan = new ScanDetails("Service X",
                List.of(new PartLine("Plăcuțe", new BigDecimal("1"), new BigDecimal("210.00"))),
                new BigDecimal("80.00"));
        List<VehicleEvent> all = List.of(
                full(f, EventType.SERVICE, "2025-01-01", 1000, null, null, scan, EvidenceLevel.DOCUMENTED,
                        EventSource.SCAN),
                full(f, EventType.REPAIR, "2025-01-02", 1100, null, null, null, EvidenceLevel.USER_CONFIRMED,
                        EventSource.MANUAL),
                full(f, EventType.TIRES, "2025-01-03", 1200, null, null, scan, EvidenceLevel.DOCUMENTED,
                        EventSource.SCAN),
                full(f, EventType.ITP, "2025-01-04", 1300, null,
                        new Validity(LocalDate.parse("2025-01-04"), LocalDate.parse("2027-01-03")),
                        new ItpDetails("RAR Iasi", ItpResult.PASSED_WITH_REMARKS), EvidenceLevel.USER_CONFIRMED,
                        EventSource.MANUAL),
                full(f, EventType.ITP, "2025-01-05", 1400, null, null, new ItpDetails("Statia Sud", null),
                        EvidenceLevel.DOCUMENTED, EventSource.SCAN),
                full(f, EventType.ROVINIETA, "2025-01-06", null, null,
                        new Validity(LocalDate.parse("2025-01-06"), LocalDate.parse("2026-01-05")),
                        new RovinietaDetails(RovinietaDuration.TWELVE_MONTHS), EvidenceLevel.USER_CONFIRMED,
                        EventSource.MANUAL),
                full(f, EventType.INSURANCE, "2025-01-07", null, null,
                        new Validity(LocalDate.parse("2025-01-08"), LocalDate.parse("2026-01-07")),
                        new InsuranceDetails(InsuranceCoverage.CASCO, "Allianz", "POL-1"),
                        EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL),
                full(f, EventType.SAFETY_EQUIPMENT, "2025-01-08", 1500, null,
                        new Validity(LocalDate.parse("2025-01-08"), LocalDate.parse("2026-01-08")),
                        new SafetyEquipmentDetails(SafetyItem.FIRST_AID_KIT), EvidenceLevel.USER_CONFIRMED,
                        EventSource.MANUAL),
                full(f, EventType.OTHER, "2025-01-09", null, "Spălătorie", null, null, EvidenceLevel.USER_CONFIRMED,
                        EventSource.MANUAL));
        saveAll(all);

        for (VehicleEvent saved : all) {
            VehicleEvent loaded = QuarkusTransaction.requiringNew()
                    .call(() -> events.findActive(f.vin(), saved.id())).orElseThrow();
            assertEquals(saved, loaded, saved.type().name());
        }
    }

    @Test
    void preMigrationRowRoundTrips() {
        Fixture f = fixture();
        UUID id = UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery("""
                        insert into vehicle_passport.vehicle_event (id, vin, type, event_date, odometer_km, cost_amount,
                            currency, notes, details, evidence, source, created_by, period_id, document_key, created_at)
                        values (:id, :vin, 'SERVICE', date '2025-03-01', 42000, 300.00, 'RON', 'old',
                            cast('{"serviceName":"X","parts":[],"labor":null}' as jsonb), 'DOCUMENTED', 'SCAN',
                            :owner, :period, 'docs/old.pdf', timestamptz '2025-03-01 10:00:00+00')
                        """)
                .setParameter("id", id).setParameter("vin", f.vin()).setParameter("owner", f.owner())
                .setParameter("period", f.period()).executeUpdate());

        VehicleEvent loaded = QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), id))
                .orElseThrow();
        assertEquals(new ScanDetails("X", List.of(), null), loaded.details());
        assertEquals(Set.of(), loaded.components());
        assertEquals(List.of(), loaded.customFields());
        assertNull(loaded.validity());
        assertNull(loaded.customLabel());

        VehicleEvent edited = loaded.edited(loaded.facts(), new EventAnnotations("new notes", Set.of(), List.of()),
                Clock.systemUTC());
        saveAll(List.of(edited));

        VehicleEvent again = QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), id))
                .orElseThrow();
        assertEquals("new notes", again.notes());
        assertEquals(new ScanDetails("X", List.of(), null), again.details());
        assertEquals(edited, again);
    }

    @Test
    void unknownStoredDetailsKindFailsLoudly() {
        Fixture f = fixture();
        VehicleEvent e = event(f, UUID.randomUUID(), "2025-03-01", T0, 1000);
        saveAll(List.of(e));
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                        "update vehicle_passport.vehicle_event set details = cast('{\"kind\":\"BOGUS\"}' as jsonb)"
                                + " where id = :id")
                .setParameter("id", e.id()).executeUpdate());

        assertThrows(IllegalStateException.class,
                () -> QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), e.id())));
    }

    @Test
    void unknownStoredEnumValueFailsLoudly() {
        Fixture f = fixture();
        VehicleEvent e = event(f, UUID.randomUUID(), "2025-03-01", T0, 1000);
        saveAll(List.of(e));
        QuarkusTransaction.requiringNew().run(() -> em.createNativeQuery(
                        "update vehicle_passport.vehicle_event set details = cast("
                                + "'{\"kind\":\"INSURANCE\",\"coverage\":\"BOGUS\",\"insurer\":\"X\"}' as jsonb)"
                                + " where id = :id")
                .setParameter("id", e.id()).executeUpdate());

        assertThrows(IllegalStateException.class,
                () -> QuarkusTransaction.requiringNew().call(() -> events.findActive(f.vin(), e.id())));
    }

    @Test
    void componentsAreStoredSorted() {
        Fixture f = fixture();
        // declaration order ENGINE, BRAKES, ELECTRICAL differs from the alphabetical order
        VehicleEvent e = new VehicleEvent(UUID.randomUUID(), f.vin(), EventType.REPAIR, LocalDate.parse("2025-03-01"),
                1000, new BigDecimal("1.00"), "RON", null, null, null, null,
                Set.of(Component.ELECTRICAL, Component.ENGINE, Component.BRAKES), List.of(),
                EvidenceLevel.USER_CONFIRMED, EventSource.MANUAL, f.owner(), f.period(), null, T0, null);
        saveAll(List.of(e));

        Object stored = QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                        "select array_to_string(components, ',') from vehicle_passport.vehicle_event where id = :id")
                .setParameter("id", e.id()).getSingleResult());
        assertEquals("BRAKES,ELECTRICAL,ENGINE", stored);
    }

    @Test
    void neighboursIgnoreEventsWithoutKm() {
        Fixture f = fixture();
        VehicleEvent service = event(f, UUID.randomUUID(), "2025-01-01", T0, 100000);
        VehicleEvent insurance = full(f, EventType.INSURANCE, "2025-02-01", null, null,
                new Validity(LocalDate.parse("2025-02-01"), LocalDate.parse("2026-01-31")),
                new InsuranceDetails(InsuranceCoverage.RCA, "Groupama", null), EvidenceLevel.USER_CONFIRMED,
                EventSource.MANUAL);
        saveAll(List.of(service, insurance));

        Neighbours around = QuarkusTransaction.requiringNew()
                .call(() -> events.neighbours(f.vin(), LocalDate.parse("2025-03-01"), T0, UUID.randomUUID()));
        assertEquals(100000, around.previousKm());
        assertNull(around.nextKm());

        Neighbours before = QuarkusTransaction.requiringNew()
                .call(() -> events.neighbours(f.vin(), LocalDate.parse("2024-12-01"), T0, UUID.randomUUID()));
        assertEquals(100000, before.nextKm());
    }

    private Callable<Object> add(Fixture f, String date, int km) {
        return () -> adding.add(new AddEventCommand(f.owner(), f.vin(), new EventInput("SERVICE",
                LocalDate.parse(date), km, BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
    }
}
