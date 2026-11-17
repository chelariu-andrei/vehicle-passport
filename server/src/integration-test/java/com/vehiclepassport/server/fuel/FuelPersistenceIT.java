package com.vehiclepassport.server.fuel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.fuel.application.port.out.FuelEntryRepositoryPort;
import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntry;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class FuelPersistenceIT {

    private static final Instant T0 = Instant.parse("2026-10-01T10:00:00Z");
    private static final String VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

    @Inject
    FuelEntryRepositoryPort entries;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AssertActiveOwnerUseCase owners;
    @Inject
    EntityManager em;

    private record Fixture(String vin, UUID owner, UUID period) {
    }

    private Fixture fixture() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder vin = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            vin.append(VIN_ALPHABET.charAt(r.nextInt(VIN_ALPHABET.length())));
        }
        UUID owner = UUID.randomUUID();
        registering.register(new RegisterVehicleCommand(owner, vin.toString(), "Dacia", "Duster", null, 2020,
                "HYBRID"));
        return new Fixture(vin.toString(), owner, owners.assertActiveOwner(vin.toString(), owner).periodId());
    }

    private static FuelEntry entry(Fixture f, UUID id, String date, int km, Instant createdAt) {
        return new FuelEntry(id, f.vin(), f.period(), f.owner(), LocalDate.parse(date), km, FuelEntryType.DIESEL,
                new BigDecimal("40.000"), new BigDecimal("300.00"), new BigDecimal("7.5000"), "RON",
                FuelGrade.STANDARD, null, null, null, true, false, createdAt);
    }

    private void saveAll(List<FuelEntry> list) {
        QuarkusTransaction.requiringNew().run(() -> list.forEach(entries::save));
    }

    private List<FuelEntry> all(String vin, UUID period) {
        return QuarkusTransaction.requiringNew().call(() -> entries.all(vin, period));
    }

    private FuelEntryRepositoryPort.Page page(Fixture f, String cursor, int limit) {
        return QuarkusTransaction.requiringNew().call(() -> entries.page(f.vin(), f.period(), cursor, limit));
    }

    @Test
    void migration_creates_table_and_index() {
        long columns = QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery(
                "select count(*) from information_schema.columns where table_schema = 'vehicle_passport'"
                        + " and table_name = 'fuel_entry'").getSingleResult()).longValue());
        assertEquals(20, columns);
        String index = QuarkusTransaction.requiringNew().call(() -> (String) em.createNativeQuery(
                "select indexdef from pg_indexes where schemaname = 'vehicle_passport'"
                        + " and indexname = 'fuel_entry_by_vin_date'").getSingleResult());
        assertTrue(index.contains("(vin, period_id, entry_date, odometer_km, id)"), index);
        assertTrue(index.contains("WHERE (deleted_at IS NULL)"), index);
    }

    @Test
    void save_and_find_roundtrip_keeps_decimals() {
        Fixture f = fixture();
        FuelEntry e = new FuelEntry(UUID.randomUUID(), f.vin(), f.period(), f.owner(), LocalDate.parse("2026-10-02"),
                10000, FuelEntryType.ELECTRIC, new BigDecimal("38.200"), new BigDecimal("312.00"),
                new BigDecimal("8.1675"), "EUR", null, ChargeType.DC_FAST, "Ionity A1", "road trip", false, true,
                T0);
        saveAll(List.of(e));
        FuelEntry back = QuarkusTransaction.requiringNew()
                .call(() -> entries.find(f.vin(), f.period(), e.id()).orElseThrow());
        assertEquals(e, back);
        assertEquals(new BigDecimal("38.200"), back.quantity());
        assertEquals(new BigDecimal("8.1675"), back.unitPrice());
        assertEquals(new BigDecimal("312.00"), back.total());
    }

    @Test
    void save_replaces_an_existing_entry() {
        Fixture f = fixture();
        UUID id = UUID.randomUUID();
        saveAll(List.of(entry(f, id, "2026-10-02", 10000, T0)));
        saveAll(List.of(entry(f, id, "2026-10-03", 10100, T0)));
        List<FuelEntry> stored = all(f.vin(), f.period());
        assertEquals(1, stored.size());
        assertEquals(10100, stored.get(0).odometerKm());
    }

    @Test
    void all_returns_sorted_and_excludes_soft_deleted() {
        Fixture f = fixture();
        FuelEntry c = entry(f, UUID.randomUUID(), "2026-10-05", 10500, T0);
        FuelEntry a = entry(f, UUID.randomUUID(), "2026-10-01", 10000, T0.plusSeconds(5));
        FuelEntry b2 = entry(f, UUID.randomUUID(), "2026-10-03", 10200, T0.plusSeconds(2));
        FuelEntry b1 = entry(f, UUID.randomUUID(), "2026-10-03", 10200, T0.plusSeconds(1));
        FuelEntry gone = entry(f, UUID.randomUUID(), "2026-10-04", 10300, T0);
        saveAll(List.of(c, a, b2, b1, gone));
        QuarkusTransaction.requiringNew().run(() -> entries.softDelete(gone.id(), T0.plusSeconds(60)));
        assertEquals(List.of(a.id(), b1.id(), b2.id(), c.id()),
                all(f.vin(), f.period()).stream().map(FuelEntry::id).toList());
        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> entries.find(f.vin(), f.period(), gone.id())).isEmpty());
    }

    @Test
    void entries_of_other_period_are_invisible() {
        Fixture f = fixture();
        Fixture other = fixture();
        FuelEntry e = entry(f, UUID.randomUUID(), "2026-10-01", 10000, T0);
        saveAll(List.of(e));
        assertTrue(all(f.vin(), other.period()).isEmpty());
        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> entries.find(f.vin(), other.period(), e.id())).isEmpty());
        assertTrue(QuarkusTransaction.requiringNew()
                .call(() -> entries.page(f.vin(), other.period(), null, 10)).items().isEmpty());
        assertEquals(1, all(f.vin(), f.period()).size());
    }

    @Test
    void page_walks_newest_first_by_cursor_without_duplicates() {
        Fixture f = fixture();
        List<FuelEntry> saved = new ArrayList<>();
        // ties on date and km, broken by id
        for (int i = 0; i < 4; i++) {
            saved.add(entry(f, UUID.randomUUID(), "2026-10-03", 10200, T0.plusSeconds(i)));
        }
        saved.add(entry(f, UUID.randomUUID(), "2026-10-03", 10300, T0));
        saved.add(entry(f, UUID.randomUUID(), "2026-10-01", 10000, T0));
        saved.add(entry(f, UUID.randomUUID(), "2026-10-09", 10900, T0));
        saveAll(saved);
        List<UUID> expected = saved.stream().sorted(Comparator.comparing(FuelEntry::date)
                        .thenComparingInt(FuelEntry::odometerKm).thenComparing(e -> e.id().toString()).reversed())
                .map(FuelEntry::id).toList();

        List<UUID> seen = new ArrayList<>();
        String cursor = null;
        int pages = 0;
        do {
            FuelEntryRepositoryPort.Page p = page(f, cursor, 2);
            p.items().forEach(e -> seen.add(e.id()));
            cursor = p.nextCursor();
            pages++;
        } while (cursor != null);
        assertEquals(expected, seen);
        assertEquals(4, pages);

        FuelEntryRepositoryPort.Page exact = page(f, null, 7);
        assertEquals(7, exact.items().size());
        assertNull(exact.nextCursor());
    }

    @Test
    void all_by_creator_spans_cars_and_periods_and_excludes_soft_deleted() {
        Fixture f = fixture();
        Fixture other = fixture();
        // the same person on a second car, in its own period
        Fixture mine2 = new Fixture(other.vin(), f.owner(), other.period());
        FuelEntry a = entry(f, UUID.randomUUID(), "2026-10-01", 10000, T0);
        FuelEntry b = entry(mine2, UUID.randomUUID(), "2025-05-01", 50000, T0);
        FuelEntry gone = entry(f, UUID.randomUUID(), "2026-10-02", 10100, T0);
        FuelEntry theirs = entry(other, UUID.randomUUID(), "2026-10-03", 10200, T0);
        saveAll(List.of(a, b, gone, theirs));
        QuarkusTransaction.requiringNew().run(() -> entries.softDelete(gone.id(), T0.plusSeconds(60)));

        List<UUID> mine = QuarkusTransaction.requiringNew().call(() -> entries.allByCreator(f.owner())).stream()
                .map(FuelEntry::id).toList();
        assertEquals(2, mine.size());
        assertTrue(mine.containsAll(List.of(a.id(), b.id())), mine.toString());
    }

    @Test
    void delete_by_creator_removes_the_rows_including_soft_deleted() {
        Fixture f = fixture();
        Fixture other = fixture();
        FuelEntry a = entry(f, UUID.randomUUID(), "2026-10-01", 10000, T0);
        FuelEntry gone = entry(f, UUID.randomUUID(), "2026-10-02", 10100, T0);
        FuelEntry theirs = entry(other, UUID.randomUUID(), "2026-10-03", 10200, T0);
        saveAll(List.of(a, gone, theirs));
        QuarkusTransaction.requiringNew().run(() -> entries.softDelete(gone.id(), T0.plusSeconds(60)));

        QuarkusTransaction.requiringNew().run(() -> entries.deleteByCreator(f.owner()));

        long left = QuarkusTransaction.requiringNew().call(() -> ((Number) em.createNativeQuery(
                "select count(*) from vehicle_passport.fuel_entry where created_by = ?1")
                .setParameter(1, f.owner()).getSingleResult()).longValue());
        assertEquals(0, left);
        assertEquals(List.of(theirs.id()), all(other.vin(), other.period()).stream().map(FuelEntry::id).toList());
    }

    @Test
    void bad_cursor_is_validation_failed() {
        Fixture f = fixture();
        for (String bad : List.of("not base64 !!", Base64.getUrlEncoder().encodeToString(
                "2026-10-01|x|nope".getBytes(StandardCharsets.UTF_8)), Base64.getUrlEncoder().encodeToString(
                "only-one-part".getBytes(StandardCharsets.UTF_8)))) {
            DomainException e = assertThrows(DomainException.class, () -> page(f, bad, 10), bad);
            assertEquals("validation-failed", e.code());
        }
    }
}
