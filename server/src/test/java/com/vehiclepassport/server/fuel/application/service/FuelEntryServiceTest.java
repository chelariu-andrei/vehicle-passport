package com.vehiclepassport.server.fuel.application.service;

import static com.vehiclepassport.server.fuel.application.service.FuelFakes.VIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.fuel.application.port.in.FuelEntryCommand;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryPage;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryView;
import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelUnit;
import com.vehiclepassport.server.fuel.domain.model.VehicleFuel;
import com.vehiclepassport.server.shared.error.DomainException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FuelEntryServiceTest {

    private static final LocalDate D1 = LocalDate.of(2026, 10, 1);
    private static final LocalDate D2 = LocalDate.of(2026, 10, 10);
    private static final LocalDate D3 = LocalDate.of(2026, 10, 20);

    private FuelFakes.Repo repo;
    private FuelFakes.Owners owners;
    private FuelFakes.Odometer odometer;
    private FuelFakes.Vehicles vehicles;
    private FuelEntryService service;
    private UUID owner;

    @BeforeEach
    void setUp() {
        repo = new FuelFakes.Repo();
        owners = new FuelFakes.Owners();
        odometer = new FuelFakes.Odometer();
        vehicles = new FuelFakes.Vehicles();
        service = new FuelEntryService(repo, owners, odometer, vehicles, new FuelFakes.FixedClock());
        owner = UUID.randomUUID();
        owners.own(owner);
    }

    private FuelEntryCommand cmd(UUID entryId, LocalDate date, int km, String quantity, String total) {
        return new FuelEntryCommand(owner, VIN, entryId, date, km, FuelEntryType.DIESEL, new BigDecimal(quantity),
                new BigDecimal(total), "RON", true, false, null, null, null, null);
    }

    private FuelEntryView add(LocalDate date, int km) {
        return service.add(cmd(null, date, km, "40.0", "300.00"));
    }

    private static String code(Runnable r) {
        return assertThrows(DomainException.class, r::run).code();
    }

    @Test
    void add_saves_and_returns_view_with_unit_price() {
        FuelEntryView v = service.add(cmd(null, D1, 10000, "38.2", "312.00"));
        assertEquals(new BigDecimal("8.1675"), v.unitPrice());
        assertEquals(FuelUnit.L, v.unit());
        assertNull(v.consumption());
        assertEquals(1, repo.rows.size());
        assertEquals(v.id(), repo.rows.keySet().iterator().next());
    }

    @Test
    void add_returns_consumption_when_it_closes_a_segment() {
        add(D1, 10000);
        FuelEntryView second = service.add(cmd(null, D3, 10600, "42.0", "315.00"));
        assertEquals(new BigDecimal("7.00"), second.consumption());
    }

    @Test
    void non_owner_gets_vehicle_not_found() {
        FuelEntryCommand c = new FuelEntryCommand(UUID.randomUUID(), VIN, null, D1, 10000, FuelEntryType.DIESEL,
                BigDecimal.TEN, BigDecimal.TEN, "RON", true, false, null, null, null, null);
        assertEquals("vehicle-not-found", code(() -> service.add(c)));
        assertEquals("vehicle-not-found",
                code(() -> service.list(UUID.randomUUID(), VIN, null, 30)));
    }

    @Test
    void odometer_below_previous_entry_is_refused() {
        add(D1, 10000);
        assertEquals("odometer-inconsistent", code(() -> add(D2, 9900)));
    }

    @Test
    void odometer_above_next_entry_is_refused() {
        add(D3, 10600);
        assertEquals("odometer-inconsistent", code(() -> add(D2, 10700)));
    }

    @Test
    void odometer_below_recorded_event_is_refused() {
        odometer.consistent = false;
        assertEquals("odometer-inconsistent", code(() -> add(D1, 10000)));
        assertTrue(repo.rows.isEmpty());
    }

    @Test
    void update_rechecks_odometer_against_neighbours_excluding_itself() {
        FuelEntryView only = add(D3, 11000);
        // Moved earlier with a higher km: only its own old reading would be "later", and it does not count.
        FuelEntryView edited = service.update(cmd(only.id(), D2, 11500, "40.0", "300.00"));
        assertEquals(11500, edited.odometerKm());
        assertEquals(D2, edited.date());
        assertEquals(1, repo.all(VIN, owners.periodByOwner.get(owner)).size());
    }

    @Test
    void update_middle_entry_above_next_is_refused() {
        add(D1, 10000);
        FuelEntryView middle = add(D2, 10600);
        add(D3, 11200);
        assertEquals("odometer-inconsistent",
                code(() -> service.update(cmd(middle.id(), D2, 11300, "40.0", "300.00"))));
        odometer.consistent = false;
        assertEquals("odometer-inconsistent",
                code(() -> service.update(cmd(middle.id(), D2, 10700, "40.0", "300.00"))));
    }

    @Test
    void update_of_unknown_entry_is_not_found() {
        assertEquals("fuel-entry-not-found",
                code(() -> service.update(cmd(UUID.randomUUID(), D1, 10000, "40.0", "300.00"))));
    }

    @Test
    void delete_is_soft_and_idempotent_for_unknown_id_is_404() {
        FuelEntryView v = add(D1, 10000);
        service.delete(owner, VIN, v.id());
        assertTrue(repo.deleted.containsKey(v.id()));
        assertTrue(repo.rows.containsKey(v.id()), "row is kept, only marked deleted");
        assertEquals("fuel-entry-not-found", code(() -> service.delete(owner, VIN, v.id())));
        assertEquals("fuel-entry-not-found", code(() -> service.delete(owner, VIN, UUID.randomUUID())));
    }

    @Test
    void electric_on_diesel_vehicle_is_refused() {
        FuelEntryCommand c = new FuelEntryCommand(owner, VIN, null, D1, 10000, FuelEntryType.ELECTRIC,
                new BigDecimal("30.0"), new BigDecimal("60.00"), "RON", true, false, null, ChargeType.HOME, null,
                null);
        assertEquals("invalid-fuel-entry", code(() -> service.add(c)));
        vehicles.fuel = VehicleFuel.HYBRID;
        assertEquals(FuelUnit.KWH, service.add(c).unit());
    }

    @Test
    void list_is_newest_first_with_consumption() {
        add(D1, 10000);
        add(D3, 10600);
        FuelEntryPage page = service.list(owner, VIN, null, 1);
        assertEquals(1, page.items().size());
        assertEquals(D3, page.items().get(0).date());
        assertEquals(new BigDecimal("6.67"), page.items().get(0).consumption());
        FuelEntryPage rest = service.list(owner, VIN, page.nextCursor(), 1);
        assertEquals(D1, rest.items().get(0).date());
        assertNull(rest.nextCursor());
    }
}
