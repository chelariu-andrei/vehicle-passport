package com.vehiclepassport.server.event.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.GetTimelineUseCase;
import com.vehiclepassport.server.event.application.port.in.TimelinePage;
import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.TestClock;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.cucumber.java.Before;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@ApplicationScoped
public class EventSteps {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String OWNED_KEY = "event.owned";
    private static final String RESULT_KEY = "event.result";
    private static final String ORDER_KEY = "event.expectedOrder";
    private static final String TIMELINE_KEY = "event.timeline";

    @Inject
    World world;

    @Inject
    TestClock clock;

    @Inject
    AddEventUseCase addEvent;

    @Inject
    GetTimelineUseCase timeline;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    ReleaseVehicleUseCase release;

    @Before
    public void resetClock() {
        clock.set(TestClock.DEFAULT_NOW);
    }

    @Given("I own vehicle V")
    public void iOwnVehicleV() {
        ownAsMe();
    }

    @Given("V is owned by another user")
    public void vIsOwnedByAnotherUser() {
        registerAs(world.user("Alice"));
        world.put(OWNED_KEY, true);
    }

    @Given("V has an event on {word} at {int} km")
    public void vHasAnEventOn(String date, int km) {
        ownAsMe();
        addAs(world.me(), date, km);
    }

    @Given("V has events by a previous owner and by me")
    public void vHasEventsByAPreviousOwnerAndByMe() {
        UUID alice = world.user("Alice");
        registerAs(alice);
        addAs(alice, "2025-01-10", 100000);
        addAs(alice, "2025-03-10", 120000);
        release.release(VIN, alice);
        ownAsMe();
        addAs(world.me(), "2025-02-10", 110000);
        world.put(ORDER_KEY, List.of("2025-01-10", "2025-02-10", "2025-03-10"));
    }

    @Given("V has {int} events")
    public void vHasEvents(int count) {
        ownAsMe();
        // Inserted out of date order on purpose; kilometres follow the dates.
        List<Integer> insertionOrder = List.of(3, 1, 5, 2, 4);
        assertEquals(count, insertionOrder.size());
        List<UUID> ids = new ArrayList<>();
        for (int idx : insertionOrder) {
            clock.advance(Duration.ofSeconds(1));
            EventView v = addAs(world.me(), LocalDate.of(2025, idx, 1).toString(), 100000 + idx * 1000);
            ids.add(v.id());
        }
        List<UUID> byDate = new ArrayList<>();
        for (int idx = 1; idx <= count; idx++) {
            byDate.add(ids.get(insertionOrder.indexOf(idx)));
        }
        world.put(ORDER_KEY, byDate);
    }

    @Given("V has two events on {word} created in sequence")
    public void vHasTwoEventsOnCreatedInSequence(String date) {
        ownAsMe();
        EventView first = addAs(world.me(), date, 1000);
        clock.advance(Duration.ofSeconds(1));
        EventView second = addAs(world.me(), date, 2000);
        world.put(ORDER_KEY, List.of(first.id(), second.id()));
    }

    @When("I add a {word} event on {word} at {int} km costing {int} RON")
    public void iAddAnEventCosting(String type, String date, int km, int cost) {
        world.attempt(() -> world.put(RESULT_KEY, addEvent.add(new AddEventCommand(
            world.me(), VIN, type, LocalDate.parse(date), km, BigDecimal.valueOf(cost), "RON", "note"))));
    }

    @When("I add an event on {word} at {int} km")
    public void iAddAnEvent(String date, int km) {
        world.attempt(() -> world.put(RESULT_KEY, addEvent.add(new AddEventCommand(
            world.me(), VIN, "SERVICE", LocalDate.parse(date), km, null, null, null))));
    }

    @When("I request the timeline")
    public void iRequestTheTimeline() {
        world.attempt(() -> world.put(TIMELINE_KEY, timeline.get(world.me(), VIN, null, 100).items()));
    }

    @When("I read the timeline {int} at a time")
    public void iReadTheTimelineAtATime(int size) {
        List<EventView> seen = new ArrayList<>();
        String cursor = null;
        int guard = 0;
        do {
            TimelinePage page = timeline.get(world.me(), VIN, cursor, size);
            assertTrue(page.items().size() <= size);
            seen.addAll(page.items());
            cursor = page.nextCursor();
            assertTrue(++guard < 50, "pagination does not terminate");
        } while (cursor != null);
        world.put(TIMELINE_KEY, seen);
    }

    @Then("the event is saved with evidence {word}")
    public void theEventIsSavedWithEvidence(String evidence) {
        assertNoError();
        EventView view = world.get(RESULT_KEY);
        assertNotNull(view);
        assertEquals(evidence, view.evidence());
        assertEquals("MANUAL", view.source());
        assertNull(view.details());
        List<EventView> stored = timeline.get(world.me(), VIN, null, 100).items();
        assertTrue(stored.stream().anyMatch(e -> e.id().equals(view.id())), "event should be on the timeline");
    }

    @Then("it is rejected with an odometer inconsistency error")
    public void itIsRejectedWithAnOdometerInconsistencyError() {
        RuntimeException error = world.lastError();
        assertNotNull(error, "expected a rejection");
        assertEquals("odometer-inconsistent", ((DomainException) error).code());
        List<EventView> stored = timeline.get(world.me(), VIN, null, 100).items();
        assertEquals(1, stored.size(), "the rejected event must not be stored");
    }

    @Then("events are in chronological order")
    public void eventsAreInChronologicalOrder() {
        assertNoError();
        List<EventView> items = world.get(TIMELINE_KEY);
        List<String> expected = world.get(ORDER_KEY);
        assertEquals(expected, items.stream().map(e -> e.date().toString()).toList());
    }

    @Then("no event reveals who created it")
    public void noEventRevealsWhoCreatedIt() {
        List<EventView> items = world.get(TIMELINE_KEY);
        assertFalse(items.isEmpty());
        for (RecordComponent c : EventView.class.getRecordComponents()) {
            String name = c.getName().toLowerCase(Locale.ROOT);
            assertFalse(name.contains("creat") || name.contains("user") || name.contains("owner")
                || name.contains("period"), "EventView exposes " + c.getName());
        }
        for (EventView e : items) {
            for (String who : List.of("Alice", "me")) {
                assertFalse(e.toString().contains(world.user(who).toString()), e.toString());
            }
        }
    }

    @Then("I see all {int} events exactly once, in order")
    public void iSeeAllEventsExactlyOnceInOrder(int count) {
        List<EventView> items = world.get(TIMELINE_KEY);
        List<UUID> expected = world.get(ORDER_KEY);
        List<UUID> ids = items.stream().map(EventView::id).toList();
        assertEquals(count, ids.size());
        assertEquals(count, new HashSet<>(ids).size(), "no repeats");
        assertEquals(expected, ids);
    }

    @Then("they appear in creation order")
    public void theyAppearInCreationOrder() {
        List<EventView> items = world.get(TIMELINE_KEY);
        List<UUID> expected = world.get(ORDER_KEY);
        assertEquals(expected, items.stream().map(EventView::id).toList());
    }

    private void ownAsMe() {
        if (world.get(OWNED_KEY) == null) {
            registerAs(world.me());
            world.put(OWNED_KEY, true);
        }
    }

    private void registerAs(UUID user) {
        register.register(new RegisterVehicleCommand(user, VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    private EventView addAs(UUID user, String date, int km) {
        return addEvent.add(new AddEventCommand(
            user, VIN, "SERVICE", LocalDate.parse(date), km, BigDecimal.TEN, "RON", null));
    }

    private void assertNoError() {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
    }
}
