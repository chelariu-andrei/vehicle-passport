package com.vehiclepassport.server.fuel.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.fuel.application.port.in.AddFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.DeleteFuelEntryUseCase;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryCommand;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryPage;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryView;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesUseCase;
import com.vehiclepassport.server.fuel.application.port.in.UpdateFuelEntryUseCase;
import com.vehiclepassport.server.fuel.domain.model.ChargeType;
import com.vehiclepassport.server.fuel.domain.model.FuelEntryType;
import com.vehiclepassport.server.fuel.domain.model.FuelGrade;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Fill-ups of V (fuel spec §9.1). Fill-ups are written through the use cases as the owner states them; a compact
 * table gives date, km, quantity, total and full, and optionally missed, type, currency, grade, charge, station and
 * note. The type defaults to the car's own fuel (PETROL for a HYBRID or OTHER car).
 */
@ApplicationScoped
public class FuelSteps {

    /** V, shared with the event, scan and passport steps. */
    static final String VIN = "WVWZZZ1JZXW000001";
    /** Written by EventSteps too: once set, the event steps do not register V again. */
    private static final String EVENT_OWNED_KEY = "event.owned";
    static final String VEHICLE_FUEL_KEY = "fuel.vehicleFuel";
    static final String RESULT_KEY = "fuel.result";
    private static final String COMMANDS_KEY = "fuel.commandsByDate";
    private static final String CREATED_KEY = "fuel.createdInOrder";
    private static final String LAST_KEY = "fuel.lastTank";
    private static final String SEEN_KEY = "fuel.seen";
    private static final List<String> COUNTS = List.of("zero", "one", "two", "three", "four", "five", "six",
            "seven", "eight", "nine", "ten");
    private static final BigDecimal SEGMENT_KM = new BigDecimal("500");
    private static final BigDecimal PRICE = new BigDecimal("7.00");

    @Inject
    World world;
    @Inject
    Clock clock;
    @Inject
    RegisterVehicleUseCase register;
    @Inject
    AddFuelEntryUseCase adding;
    @Inject
    UpdateFuelEntryUseCase updating;
    @Inject
    DeleteFuelEntryUseCase deleting;
    @Inject
    ListFuelEntriesUseCase listing;

    @Given("I own vehicle V with fuel {word}")
    public void iOwnVehicleVWithFuel(String fuel) {
        register.register(new RegisterVehicleCommand(world.me(), VIN, "Volkswagen", "Golf", null, 2018, fuel));
        world.put(EVENT_OWNED_KEY, true);
        world.put(VEHICLE_FUEL_KEY, fuel);
    }

    @Given("V has these fill-ups")
    public void vHasTheseFillUps(DataTable table) {
        for (Map<String, String> row : table.asMaps()) {
            add(command(row));
        }
    }

    @When("I add this fill-up")
    public void iAddThisFillUp(DataTable table) {
        List<Map<String, String>> rows = table.asMaps();
        assertEquals(1, rows.size(), "one fill-up expected");
        FuelEntryCommand c = command(rows.get(0));
        world.attempt(() -> world.put(RESULT_KEY, add(c)));
    }

    @When("I add these fill-ups")
    public void iAddTheseFillUps(DataTable table) {
        List<FuelEntryCommand> commands = table.asMaps().stream().map(this::command).toList();
        world.attempt(() -> commands.forEach(this::add));
    }

    /** Full tanks 500 km apart at the given rate, after an opening full tank when V has none from this step. */
    @Given("V has {word} consecutive full tanks at {bigdecimal} L\\/100 km")
    public void vHasConsecutiveFullTanks(String count, BigDecimal per100) {
        tanks(number(count), per100, null);
    }

    @Given("V has {word} consecutive {word} full tanks at {bigdecimal} L\\/100 km")
    public void vHasConsecutiveGradedFullTanks(String count, String grade, BigDecimal per100) {
        tanks(number(count), per100, FuelGrade.valueOf(grade));
    }

    @Given("V then has a full tank at {bigdecimal} L\\/100 km")
    public void vThenHasAFullTank(BigDecimal per100) {
        tanks(1, per100, null);
    }

    /** Full tanks three days and 300 km apart, oldest first from 2026-10-01. */
    @Given("V has {int} fill-ups")
    public void vHasFillUps(int count) {
        for (int i = 0; i < count; i++) {
            add(new FuelEntryCommand(world.me(), VIN, null, LocalDate.parse("2026-10-01").plusDays(3L * i),
                    10000 + 300 * i, defaultType(), new BigDecimal("30.0"), new BigDecimal("225.00"), "RON", true,
                    false, null, null, null, null));
        }
    }

    @When("I change the km of the fill-up of {word} to {int}")
    public void iChangeTheKmOfTheFillUp(String date, int km) {
        FuelEntryCommand c = commands().get(LocalDate.parse(date));
        assertNotNull(c, "no fill-up on " + date);
        FuelEntryCommand changed = new FuelEntryCommand(c.userId(), c.vin(), c.entryId(), c.date(), km, c.fuelType(),
                c.quantity(), c.total(), c.currency(), c.fullTank(), c.missedPrevious(), c.grade(), c.chargeType(),
                c.station(), c.note());
        world.attempt(() -> {
            updating.update(changed);
            commands().put(changed.date(), changed);
        });
    }

    @When("I delete the fill-up of {word}")
    public void iDeleteTheFillUp(String date) {
        FuelEntryCommand c = commands().get(LocalDate.parse(date));
        assertNotNull(c, "no fill-up on " + date);
        world.attempt(() -> deleting.delete(world.me(), VIN, c.entryId()));
    }

    @When("I list the fill-ups of V {int} at a time")
    public void iListTheFillUpsAtATime(int size) {
        List<UUID> seen = new ArrayList<>();
        String cursor = null;
        do {
            FuelEntryPage page = listing.list(world.me(), VIN, cursor, size);
            assertTrue(page.items().size() <= size);
            page.items().forEach(v -> seen.add(v.id()));
            cursor = page.nextCursor();
        } while (cursor != null);
        world.put(SEEN_KEY, seen);
    }

    @When("I list the fill-ups of V with the cursor {string}")
    public void iListTheFillUpsWithTheCursor(String cursor) {
        world.attempt(() -> listing.list(world.me(), VIN, cursor, 30));
    }

    @Then("the fill-up is saved with unit price {bigdecimal} per {word}")
    public void theFillUpIsSavedWithUnitPrice(BigDecimal unitPrice, String unit) {
        assertNull(world.lastError(), () -> "unexpected " + world.lastError());
        FuelEntryView result = world.get(RESULT_KEY);
        assertEquals(unitPrice, result.unitPrice());
        assertEquals(unit, result.unit().name());
        FuelEntryView stored = listed().stream().filter(v -> v.id().equals(result.id())).findFirst().orElseThrow();
        assertEquals(unitPrice, stored.unitPrice());
    }

    @Then("V lists {int} fill-ups")
    public void vListsFillUps(int count) {
        assertNull(world.lastError(), () -> "unexpected " + world.lastError());
        assertEquals(count, listed().size());
    }

    @Then("the fill-up of {word} is measured in {word}")
    public void theFillUpIsMeasuredIn(String date, String unit) {
        assertEquals(unit, listedOn(date).unit().name());
    }

    @Then("the fill-up of {word} is at {int} km")
    public void theFillUpIsAtKm(String date, int km) {
        assertNull(world.lastError(), () -> "unexpected " + world.lastError());
        assertEquals(km, listedOn(date).odometerKm());
    }

    @Then("I see all {int} fill-ups exactly once, newest first")
    public void iSeeAllFillUpsNewestFirst(int count) {
        List<UUID> expected = new ArrayList<>(created());
        Collections.reverse(expected);
        assertEquals(count, expected.size());
        assertEquals(expected, world.get(SEEN_KEY));
    }

    // ---- helpers ----

    private FuelEntryView add(FuelEntryCommand c) {
        FuelEntryView v = adding.add(c);
        FuelEntryCommand saved = new FuelEntryCommand(c.userId(), c.vin(), v.id(), c.date(), c.odometerKm(),
                c.fuelType(), c.quantity(), c.total(), c.currency(), c.fullTank(), c.missedPrevious(), c.grade(),
                c.chargeType(), c.station(), c.note());
        commands().put(c.date(), saved);
        created().add(v.id());
        return v;
    }

    private void tanks(int count, BigDecimal per100, FuelGrade grade) {
        int[] last = world.get(LAST_KEY);
        LocalDate date;
        int km;
        if (last == null) {
            // Opening full tank, far enough back that every tank of a scenario stays inside the default 6m period.
            date = LocalDate.now(clock).minusDays(120);
            km = 20000;
            add(tank(date, km, new BigDecimal("40.0"), grade));
        } else {
            date = LocalDate.ofEpochDay(last[0]);
            km = last[1];
        }
        BigDecimal quantity = per100.multiply(SEGMENT_KM).divide(new BigDecimal("100"), 3, RoundingMode.HALF_UP);
        for (int i = 0; i < count; i++) {
            date = date.plusDays(3);
            km += SEGMENT_KM.intValue();
            add(tank(date, km, quantity, grade));
        }
        world.put(LAST_KEY, new int[] {(int) date.toEpochDay(), km});
    }

    private FuelEntryCommand tank(LocalDate date, int km, BigDecimal quantity, FuelGrade grade) {
        return new FuelEntryCommand(world.me(), VIN, null, date, km, defaultType(), quantity,
                quantity.multiply(PRICE).setScale(2, RoundingMode.HALF_UP), "RON", true, false, grade, null, null,
                null);
    }

    private FuelEntryCommand command(Map<String, String> row) {
        String type = text(row, "type");
        String grade = text(row, "grade");
        String charge = text(row, "charge");
        String currency = text(row, "currency");
        return new FuelEntryCommand(world.me(), VIN, null, LocalDate.parse(row.get("date")),
                Integer.parseInt(row.get("km")), type == null ? defaultType() : FuelEntryType.valueOf(type),
                new BigDecimal(row.get("quantity")), new BigDecimal(row.get("total")),
                currency == null ? "RON" : currency, !"no".equals(text(row, "full")), "yes".equals(text(row, "missed")),
                grade == null ? null : FuelGrade.valueOf(grade), charge == null ? null : ChargeType.valueOf(charge),
                text(row, "station"), text(row, "note"));
    }

    private static String text(Map<String, String> row, String column) {
        String v = row.get(column);
        return v == null || v.isBlank() ? null : v.trim();
    }

    private FuelEntryType defaultType() {
        String fuel = world.get(VEHICLE_FUEL_KEY);
        if (fuel == null) {
            return FuelEntryType.DIESEL;
        }
        return switch (fuel) {
            case "PETROL", "DIESEL", "LPG", "ELECTRIC" -> FuelEntryType.valueOf(fuel);
            default -> FuelEntryType.PETROL;
        };
    }

    private static int number(String word) {
        int n = COUNTS.indexOf(word);
        return n >= 0 ? n : Integer.parseInt(word);
    }

    private List<FuelEntryView> listed() {
        return listing.list(world.me(), VIN, null, 100).items();
    }

    private FuelEntryView listedOn(String date) {
        LocalDate d = LocalDate.parse(date);
        return listed().stream().filter(v -> v.date().equals(d)).findFirst()
                .orElseThrow(() -> new AssertionError("no fill-up listed on " + date));
    }

    private Map<LocalDate, FuelEntryCommand> commands() {
        Map<LocalDate, FuelEntryCommand> m = world.get(COMMANDS_KEY);
        if (m == null) {
            m = new HashMap<>();
            world.put(COMMANDS_KEY, m);
        }
        return m;
    }

    private List<UUID> created() {
        List<UUID> l = world.get(CREATED_KEY);
        if (l == null) {
            l = new ArrayList<>();
            world.put(CREATED_KEY, l);
        }
        return l;
    }
}
