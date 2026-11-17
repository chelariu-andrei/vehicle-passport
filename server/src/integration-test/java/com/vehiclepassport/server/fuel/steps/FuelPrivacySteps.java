package com.vehiclepassport.server.fuel.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.in.AccountExport;
import com.vehiclepassport.server.account.application.port.in.ExportMyDataUseCase;
import com.vehiclepassport.server.account.application.port.out.OwnerDataEraserPort;
import com.vehiclepassport.server.account.application.service.SingleAccountPurgeService;
import com.vehiclepassport.server.fuel.application.port.in.FuelEntryExportView;
import com.vehiclepassport.server.fuel.application.port.in.GetFuelStatsUseCase;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesByCreatorUseCase;
import com.vehiclepassport.server.fuel.application.port.in.ListFuelEntriesUseCase;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.GetPublicPassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.PassportView;
import com.vehiclepassport.server.testsupport.World;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Fuel spec §8: fill-ups belong to the person and their ownership period, and never reach a passport. */
@ApplicationScoped
public class FuelPrivacySteps {

    private static final String EXPORT_KEY = "fuel.export";
    private static final String SNAPSHOT_KEY = "fuel.snapshot";

    @Inject
    World world;
    @Inject
    ListFuelEntriesUseCase listing;
    @Inject
    GetFuelStatsUseCase stats;
    @Inject
    ListFuelEntriesByCreatorUseCase byCreator;
    @Inject
    OwnerDataEraserPort eraser;
    @Inject
    ExportMyDataUseCase export;
    @Inject
    CreatePassportUseCase passports;
    @Inject
    GetPublicPassportUseCase publicPassports;

    @Then("Alice lists no fill-ups on V")
    public void aliceListsNoFillUps() {
        assertTrue(listing.list(world.user("Alice"), FuelSteps.VIN, null, 100).items().isEmpty());
    }

    @Then("Alice's fuel stats of V count no fill-ups")
    public void alicesFuelStatsCountNoFillUps() {
        var view = stats.stats(world.user("Alice"), FuelSteps.VIN, "all");
        assertEquals(0, view.entryCount());
        assertEquals(0, view.ignoredEntries());
        assertTrue(view.byFuelType().isEmpty());
    }

    /**
     * The purge's step that reaches the other features, run directly: in the database-less profile nothing is ever
     * due, so the scheduled purge itself is covered by AccountPurgeIT.
     */
    @When("my account is purged")
    public void myAccountIsPurged() {
        assertFalse(byCreator.listByCreator(world.me()).isEmpty(), "nothing to purge");
        eraser.revokePassports(world.me());
        eraser.detachOwnedData(world.me(), SingleAccountPurgeService.TOMBSTONE);
    }

    @Then("none of my fill-ups is left")
    public void noneOfMyFillUpsIsLeft() {
        assertTrue(byCreator.listByCreator(world.me()).isEmpty());
        assertTrue(byCreator.listByCreator(SingleAccountPurgeService.TOMBSTONE).isEmpty(),
                "fill-ups are deleted, not handed to the tombstone");
    }

    @When("I export my data")
    public void iExportMyData() {
        world.put(EXPORT_KEY, export.export(world.me(), null, false));
    }

    @Then("the export lists {int} fill-ups on V")
    public void theExportListsFillUps(int count) {
        List<Map<String, Object>> entries = exported();
        assertEquals(count, entries.size());
        for (Map<String, Object> e : entries) {
            assertEquals(FuelSteps.VIN, e.get("vin"));
            assertNotNull(e.get("id"));
            assertNotNull(e.get("unitPrice"));
        }
        assertTrue(entries.stream().anyMatch(e -> "Petrom Unirii".equals(e.get("station"))));
    }

    @Then("the exported fill-up of {word} has consumption {bigdecimal}")
    public void theExportedFillUpHasConsumption(String date, BigDecimal consumption) {
        LocalDate d = LocalDate.parse(date);
        Map<String, Object> entry = exported().stream().filter(e -> d.equals(e.get("date"))).findFirst()
                .orElseThrow(() -> new AssertionError("no exported fill-up on " + date));
        assertEquals(consumption, entry.get("consumption"));
    }

    @When("I create a passport for V after my fill-ups")
    public void iCreateAPassportAfterMyFillUps() {
        PassportView p = passports.create(world.me(), FuelSteps.VIN, null);
        String url = p.publicUrl();
        world.put(SNAPSHOT_KEY, publicPassports.get(url.substring(url.lastIndexOf('/') + 1)).snapshotJson());
    }

    @Then("the passport snapshot holds none of my fill-ups")
    public void thePassportSnapshotHoldsNoneOfMyFillUps() {
        String json = world.get(SNAPSHOT_KEY);
        assertNotNull(json);
        assertTrue(json.contains("\"events\":[]"), json);
        String lower = json.toLowerCase(Locale.ROOT);
        for (String word : List.of("petrom", "private note", "quantity", "unitprice", "fulltank", "consumption",
                "odometer", "300.00", "315.00", "10600")) {
            assertFalse(lower.contains(word), "snapshot mentions " + word + ": " + json);
        }
        for (FuelEntryExportView v : byCreator.listByCreator(world.me())) {
            UUID id = v.id();
            assertFalse(json.contains(id.toString()), "snapshot names fill-up " + id);
        }
    }

    private List<Map<String, Object>> exported() {
        AccountExport e = world.get(EXPORT_KEY);
        assertNotNull(e, "no export made");
        return e.data().fuelEntries();
    }
}
