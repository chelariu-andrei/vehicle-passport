package com.vehiclepassport.server.event.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.DeadlineItemView;
import com.vehiclepassport.server.event.application.port.in.DeadlinesUseCase;
import com.vehiclepassport.server.event.application.port.in.DeadlinesView;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.testsupport.World;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Document deadlines (deadlines spec §5.2, §7). */
@ApplicationScoped
public class DeadlinesSteps {

    private static final String VIN = "WVWZZZ1JZXW000001"; // V, shared with EventSteps
    private static final String UNKNOWN_VIN = "WVWZZZ1JZXW999999";
    private static final String DEADLINES_KEY = "deadlines.view";
    private static final String NAMED_KEY = "extended.named"; // written by TimelineExtendedSteps

    @Inject
    World world;
    @Inject
    AddEventUseCase addEvent;
    @Inject
    DeadlinesUseCase deadlines;

    @Given("V has an ITP valid until {word}")
    public void vHasAnItpValidUntil(String until) {
        addEvent.add(new AddEventCommand(world.me(), VIN, new EventInput("ITP", LocalDate.parse("2024-11-13"),
                90000, new BigDecimal("150"), "RON", null, null, null, LocalDate.parse(until), null, null, null)));
    }

    @When("I request the deadlines of V")
    public void iRequestTheDeadlinesOfV() {
        request(VIN);
    }

    @When("I request the deadlines of an unknown vehicle")
    public void iRequestTheDeadlinesOfAnUnknownVehicle() {
        request(UNKNOWN_VIN);
    }

    @Then("the deadlines are {word} {word} {word} {word} {word} {word} in that order")
    public void theDeadlinesAreInOrder(String a, String b, String c, String d, String e, String f) {
        List<String> expected = Arrays.stream(new String[] {a, b, c, d, e, f})
                .map(s -> s.replace(",", "")).toList();
        assertEquals(expected, view().items().stream().map(DeadlineItemView::kind).toList());
    }

    @Then("every deadline is {word}")
    public void everyDeadlineIs(String status) {
        for (DeadlineItemView item : view().items()) {
            assertEquals(status, item.status(), item.kind());
            assertNull(item.validUntil());
            assertNull(item.daysLeft());
            assertNull(item.eventId());
        }
    }

    @Then("the {word} deadline is {word} until {word} with {int} days left")
    public void theDeadlineIs(String kind, String status, String until, int daysLeft) {
        DeadlineItemView item = item(kind);
        assertEquals(status, item.status());
        assertEquals(LocalDate.parse(until), item.validUntil());
        assertEquals(daysLeft, item.daysLeft());
        assertNotNull(item.eventId());
    }

    @Then("the {word} deadline is {word}")
    public void theDeadlineIsStatus(String kind, String status) {
        DeadlineItemView item = item(kind);
        assertEquals(status, item.status());
        if ("NOT_RECORDED".equals(status)) {
            assertNull(item.eventId());
        }
    }

    @Then("the {word} deadline points to the {word} RCA")
    public void theDeadlinePointsTo(String kind, String name) {
        Map<String, UUID> named = world.get(NAMED_KEY);
        assertEquals(named.get(name), item(kind).eventId());
    }

    private void request(String vin) {
        world.attempt(() -> world.put(DEADLINES_KEY, deadlines.get(world.me(), vin)));
    }

    private DeadlinesView view() {
        assertNull(world.lastError(), () -> String.valueOf(world.lastError()));
        DeadlinesView view = world.get(DEADLINES_KEY);
        assertNotNull(view);
        assertEquals(6, view.items().size());
        return view;
    }

    private DeadlineItemView item(String kind) {
        return view().items().stream().filter(i -> i.kind().equals(kind)).findFirst().orElseThrow();
    }
}
