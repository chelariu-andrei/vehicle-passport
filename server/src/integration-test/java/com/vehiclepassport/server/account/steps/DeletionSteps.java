package com.vehiclepassport.server.account.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.vehiclepassport.server.account.application.port.in.CancelDeletionUseCase;
import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.account.application.port.in.ScheduleDeletionUseCase;
import com.vehiclepassport.server.testsupport.World;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@ApplicationScoped
public class DeletionSteps {

    private static final String WHEN_KEY = "deletion.when";

    @Inject
    World world;
    @Inject
    Clock clock;
    @Inject
    ScheduleDeletionUseCase scheduling;
    @Inject
    CancelDeletionUseCase cancelling;
    @Inject
    GetMeUseCase getMe;

    @When("I ask to delete my account")
    public void iAskToDeleteMyAccount() {
        world.attempt(() -> world.put(WHEN_KEY, scheduling.schedule(world.me())));
    }

    @When("I cancel the deletion of my account")
    public void iCancelTheDeletionOfMyAccount() {
        world.attempt(() -> cancelling.cancel(world.me()));
    }

    @Then("my deletion is scheduled {int} days from now")
    public void myDeletionIsScheduledDaysFromNow(int days) {
        Instant when = world.get(WHEN_KEY);
        long seconds = Duration.between(clock.instant(), when).getSeconds();
        assertEquals(days, Math.round(seconds / 86400.0));
    }

    @Then("my account still opens with the deletion date")
    public void myAccountStillOpensWithTheDeletionDate() {
        Instant when = world.get(WHEN_KEY);
        assertEquals(when.truncatedTo(ChronoUnit.MICROS),
                getMe.get(world.me(), null, false).profile().deletionScheduledFor().truncatedTo(ChronoUnit.MICROS));
    }

    @Then("no deletion is scheduled")
    public void noDeletionIsScheduled() {
        assertFalse(getMe.get(world.me(), null, false).profile().deletionScheduled());
    }
}
