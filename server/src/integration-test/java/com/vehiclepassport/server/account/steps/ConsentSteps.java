package com.vehiclepassport.server.account.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.account.application.port.in.ConsentAcceptance;
import com.vehiclepassport.server.account.application.port.in.ConsentChange;
import com.vehiclepassport.server.account.application.port.in.GetConsentStatusUseCase;
import com.vehiclepassport.server.account.application.port.in.ListConsentHistoryUseCase;
import com.vehiclepassport.server.account.application.port.in.RecordConsentUseCase;
import com.vehiclepassport.server.account.domain.model.ConsentRecord;
import com.vehiclepassport.server.account.domain.model.ConsentSource;
import com.vehiclepassport.server.account.domain.model.ConsentType;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.testsupport.fake.TestClock;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

@ApplicationScoped
public class ConsentSteps {

    @Inject
    World world;
    @Inject
    Clock clock;
    @Inject
    GetConsentStatusUseCase status;
    @Inject
    RecordConsentUseCase recording;
    @Inject
    ListConsentHistoryUseCase history;

    @When("I accept terms {string} and privacy {string}")
    public void iAcceptTermsAndPrivacy(String terms, String privacy) {
        world.attempt(() -> recording.record(world.me(), new ConsentChange(
                List.of(new ConsentAcceptance(ConsentType.TERMS, terms),
                        new ConsentAcceptance(ConsentType.PRIVACY, privacy)),
                null, null, ConsentSource.SIGN_UP_FORM)));
    }

    @When("I turn marketing consent on")
    public void iTurnMarketingConsentOn() {
        recording.record(world.me(), new ConsentChange(null, true, null, ConsentSource.SETTINGS));
    }

    @When("I turn marketing consent off")
    public void iTurnMarketingConsentOff() {
        if (clock instanceof TestClock test) {
            test.advance(Duration.ofSeconds(1));
        }
        recording.record(world.me(), new ConsentChange(null, false, null, ConsentSource.SETTINGS));
    }

    @Then("my consent is required")
    public void myConsentIsRequired() {
        assertTrue(status.status(world.me()).required());
    }

    @Then("my consent is not required")
    public void myConsentIsNotRequired() {
        assertFalse(status.status(world.me()).required());
    }

    @Then("my consent history is empty")
    public void myConsentHistoryIsEmpty() {
        assertTrue(history.history(world.me()).isEmpty());
    }

    @Then("my latest consent event is marketing withdrawn")
    public void myLatestConsentEventIsMarketingWithdrawn() {
        ConsentRecord latest = history.history(world.me()).get(0);
        assertEquals(ConsentType.MARKETING, latest.type());
        assertFalse(latest.granted());
    }
}
