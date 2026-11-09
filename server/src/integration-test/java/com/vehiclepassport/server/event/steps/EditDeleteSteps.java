package com.vehiclepassport.server.event.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DeleteEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetEventDocumentUseCase;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.event.application.port.in.UpdateEventCommand;
import com.vehiclepassport.server.event.application.port.in.UpdateEventUseCase;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.shared.error.ErrorKind;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

@ApplicationScoped
public class EditDeleteSteps {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String IDS_KEY = "edit.ids";
    private static final String E_KEY = "edit.e";
    private static final String ERRORS_KEY = "edit.errors";
    private static final String EXPECTED_KEY = "edit.expectedErrors";

    @Inject
    World world;

    @Inject
    AddEventUseCase addEvent;

    @Inject
    UpdateEventUseCase updateEvent;

    @Inject
    DeleteEventUseCase deleteEvent;

    @Inject
    SaveConfirmedEventUseCase saveConfirmed;

    @Inject
    GetEventDocumentUseCase eventDocument;

    @Inject
    GetTimelineUseCase timeline;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    ReleaseVehicleUseCase release;

    @Given("V has events on {word} at {int} km, {word} at {int} km, {word} at {int} km")
    public void vHasThreeEvents(String d1, int k1, String d2, int k2, String d3, int k3) {
        registerAs(world.me());
        List<UUID> ids = new ArrayList<>();
        ids.add(add(world.me(), d1, k1).id());
        ids.add(add(world.me(), d2, k2).id());
        ids.add(add(world.me(), d3, k3).id());
        world.put(IDS_KEY, ids);
    }

    @Given("V has an event E")
    public void vHasAnEventE() {
        registerAs(world.me());
        world.put(E_KEY, add(world.me(), "2025-03-01", 120000).id());
    }

    @Given("V has an event on {word} at {int} km that I deleted")
    public void vHasADeletedEvent(String date, int km) {
        registerAs(world.me());
        EventView v = add(world.me(), date, km);
        deleteEvent.delete(world.me(), VIN, v.id());
    }

    @Given("V has a DOCUMENTED event E at {int} km")
    public void vHasADocumentedEvent(int km) {
        registerAs(world.me());
        UUID id = saveConfirmed.save(new SaveConfirmedEventCommand(world.me(), VIN, "SERVICE",
            LocalDate.parse("2025-03-01"), km, new BigDecimal("450.00"), "RON", "scan", null, "docs/key.pdf"));
        world.put(E_KEY, id);
    }

    @Given("Alice created event E during her ownership period, then ownership moved to me")
    public void aliceCreatedEThenOwnershipMoved() {
        UUID alice = world.user("Alice");
        registerAs(alice);
        world.put(E_KEY, add(alice, "2025-03-01", 120000).id());
        release.release(VIN, alice);
        registerAs(world.me());
    }

    @Given("Alice attached a document to event E, then ownership moved to me")
    public void aliceAttachedADocumentThenOwnershipMoved() {
        UUID alice = world.user("Alice");
        registerAs(alice);
        UUID id = saveConfirmed.save(new SaveConfirmedEventCommand(alice, VIN, "SERVICE",
            LocalDate.parse("2025-03-01"), 120000, new BigDecimal("450.00"), "RON", "scan", null,
            "docs/alice.pdf"));
        world.put(E_KEY, id);
        release.release(VIN, alice);
        registerAs(world.me());
    }

    @Given("I created event E, released V, and registered V again")
    public void iCreatedEReleasedAndRegisteredAgain() {
        registerAs(world.me());
        world.put(E_KEY, add(world.me(), "2025-03-01", 120000).id());
        release.release(VIN, world.me());
        registerAs(world.me());
    }

    @When("I change the middle event's km to {int}")
    public void iChangeTheMiddleKm(int km) {
        List<UUID> ids = world.get(IDS_KEY);
        edit(ids.get(1), v -> command(ids.get(1), v.date(), km, v.notes()));
    }

    @When("I change the first event's date to {word}")
    public void iChangeTheFirstDate(String date) {
        List<UUID> ids = world.get(IDS_KEY);
        edit(ids.get(0), v -> command(ids.get(0), LocalDate.parse(date), v.odometerKm(), v.notes()));
    }

    @When("I change E's km to {int}")
    public void iChangeEsKm(int km) {
        UUID id = world.get(E_KEY);
        edit(id, v -> command(id, v.date(), km, v.notes()));
    }

    @When("I change E's notes to {string}")
    public void iChangeEsNotes(String notes) {
        UUID id = world.get(E_KEY);
        edit(id, v -> command(id, v.date(), v.odometerKm(), notes));
    }

    @When("I delete E")
    public void iDeleteE() {
        UUID id = world.get(E_KEY);
        world.attempt(() -> deleteEvent.delete(world.me(), VIN, id));
    }

    @When("I try to edit E")
    public void iTryToEditE() {
        UUID id = world.get(E_KEY);
        tryEdit(id);
        world.put(ERRORS_KEY, listOf(world.lastError()));
        world.put(EXPECTED_KEY, 1);
    }

    @When("I request E's document")
    public void iRequestEsDocument() {
        UUID id = world.get(E_KEY);
        world.attempt(() -> eventDocument.get(world.me(), VIN, id));
        world.put(ERRORS_KEY, listOf(world.lastError()));
        world.put(EXPECTED_KEY, 1);
    }

    @When("I try to edit or delete E")
    public void iTryToEditOrDeleteE() {
        UUID id = world.get(E_KEY);
        tryEdit(id);
        List<RuntimeException> errors = new ArrayList<>(listOf(world.lastError()));
        world.attempt(() -> deleteEvent.delete(world.me(), VIN, id));
        errors.addAll(listOf(world.lastError()));
        world.put(ERRORS_KEY, errors);
        world.put(EXPECTED_KEY, 2);
    }

    @Then("it is rejected as forbidden")
    public void itIsRejectedAsForbidden() {
        List<RuntimeException> errors = world.get(ERRORS_KEY);
        assertNotNull(errors);
        UUID id = world.get(E_KEY);
        for (RuntimeException e : errors) {
            DomainException d = (DomainException) e;
            assertEquals(ErrorKind.FORBIDDEN, d.kind());
            assertTrue(List.of("event-from-prior-owner", "document-restricted").contains(d.code()), d.code());
        }
        int expected = world.get(EXPECTED_KEY);
        assertEquals(expected, errors.size(), "every attempt must be refused");
        // the event is unchanged and still on the timeline
        assertTrue(timeline.get(world.me(), VIN, null, 100).items().stream()
            .anyMatch(e -> e.id().equals(id) && e.odometerKm() == 120000));
    }

    @Then("the timeline shows E with a document present")
    public void theTimelineShowsEWithADocument() {
        assertTrue(find(world.get(E_KEY)).documentPresent());
    }

    @Then("the timeline does not contain E")
    public void theTimelineDoesNotContainE() {
        assertNull(world.lastError(), String.valueOf(world.lastError()));
        UUID id = world.get(E_KEY);
        assertTrue(timeline.get(world.me(), VIN, null, 100).items().stream().noneMatch(e -> e.id().equals(id)));
    }

    @Then("E has evidence {word} and notes {string}")
    public void eHasEvidenceAndNotes(String evidence, String notes) {
        assertNull(world.lastError(), String.valueOf(world.lastError()));
        EventView v = find(world.get(E_KEY));
        assertEquals(evidence, v.evidence());
        assertEquals(notes, v.notes());
        assertEquals("SCAN", v.source());
    }

    private void tryEdit(UUID id) {
        world.attempt(() -> updateEvent.update(new UpdateEventCommand(world.me(), VIN, id, "SERVICE",
            LocalDate.parse("2025-03-01"), 121000, BigDecimal.TEN, "RON", "x")));
    }

    private void edit(UUID id, Function<EventView, UpdateEventCommand> build) {
        EventView current = find(id);
        world.attempt(() -> updateEvent.update(build.apply(current)));
    }

    private UpdateEventCommand command(UUID id, LocalDate date, int km, String notes) {
        EventView v = find(id);
        return new UpdateEventCommand(world.me(), VIN, id, v.type(), date, km, v.costAmount(), v.currency(), notes);
    }

    private EventView find(UUID id) {
        return timeline.get(world.me(), VIN, null, 100).items().stream()
            .filter(e -> e.id().equals(id)).findFirst().orElseThrow();
    }

    private static List<RuntimeException> listOf(RuntimeException e) {
        return e == null ? List.of() : List.of(e);
    }

    private void registerAs(UUID user) {
        register.register(new RegisterVehicleCommand(user, VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    private EventView add(UUID user, String date, int km) {
        return addEvent.add(new AddEventCommand(
            user, VIN, "SERVICE", LocalDate.parse(date), km, BigDecimal.TEN, "RON", null));
    }
}
