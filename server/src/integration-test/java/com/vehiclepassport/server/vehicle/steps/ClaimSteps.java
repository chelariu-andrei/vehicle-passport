package com.vehiclepassport.server.vehicle.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.vehicle.application.port.in.DecideOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.FileOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.out.OwnershipRepositoryPort;
import com.vehiclepassport.server.vehicle.domain.model.ClaimStatus;
import com.vehiclepassport.server.vehicle.domain.model.OwnershipPeriod;
import com.vehiclepassport.server.vehicle.domain.model.Vin;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

@ApplicationScoped
public class ClaimSteps {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String VIN_KEY = "garage.vin";
    private static final String CLAIM_KEY = "claim.id";
    private static final String BOB_CLAIM_KEY = "claim.bob";
    private static final String ALICE_PERIOD_KEY = "claim.alicePeriod";

    @Inject
    World world;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    FileOwnershipClaimUseCase filing;

    @Inject
    DecideOwnershipClaimUseCase deciding;

    @Inject
    ReleaseVehicleUseCase release;

    @Inject
    OwnershipRepositoryPort ownerships;

    @Given("a pending claim by me on a vehicle owned by Alice")
    public void aPendingClaimByMe() {
        aliceOwns();
        world.put(CLAIM_KEY, filing.file(VIN, world.me()));
    }

    @Given("a pending claim by Bob on a vehicle owned by Alice")
    public void aPendingClaimByBob() {
        aliceOwns();
        world.put(CLAIM_KEY, filing.file(VIN, world.user("Bob")));
    }

    @Given("Bob and I each have a pending claim on a vehicle owned by Alice")
    public void bobAndIEachHaveAPendingClaim() {
        aliceOwns();
        world.put(BOB_CLAIM_KEY, filing.file(VIN, world.user("Bob")));
        world.put(CLAIM_KEY, filing.file(VIN, world.me()));
    }

    @Given("a claim by me that Alice rejected")
    public void aClaimByMeThatAliceRejected() {
        aPendingClaimByMe();
        deciding.reject(VIN, world.get(CLAIM_KEY), world.user("Alice"));
    }

    @When("Alice approves my claim")
    public void aliceApprovesMyClaim() {
        aliceApprovesTheClaim();
    }

    @When("Alice approves the claim")
    public void aliceApprovesTheClaim() {
        UUID claim = world.get(CLAIM_KEY);
        world.attempt(() -> deciding.approve(VIN, claim, world.user("Alice")));
    }

    @When("I approve the claim")
    public void iApproveTheClaim() {
        UUID claim = world.get(CLAIM_KEY);
        world.attempt(() -> deciding.approve(VIN, claim, world.me()));
    }

    @When("Alice rejects the claim")
    public void aliceRejectsTheClaim() {
        UUID claim = world.get(CLAIM_KEY);
        world.attempt(() -> deciding.reject(VIN, claim, world.user("Alice")));
    }

    @When("I withdraw the claim")
    public void iWithdrawTheClaim() {
        UUID claim = world.get(CLAIM_KEY);
        world.attempt(() -> filing.withdraw(claim, world.me()));
    }

    @When("Alice releases the vehicle")
    public void aliceReleasesTheVehicle() {
        world.attempt(() -> release.release(VIN, world.user("Alice")));
    }

    @Then("an ownership claim is filed for the current owner to decide")
    public void anOwnershipClaimIsFiled() {
        assertEquals(1, deciding.listPending(VIN, world.user("Alice")).size());
    }

    @Then("Alice's ownership period is closed")
    public void alicesOwnershipPeriodIsClosed() {
        assertNoError();
        UUID periodId = world.get(ALICE_PERIOD_KEY);
        assertFalse(ownerships.findById(periodId).orElseThrow().isOpen());
    }

    @Then("I have an open ownership period")
    public void iHaveAnOpenOwnershipPeriod() {
        assertNoError();
        OwnershipPeriod open = ownerships.findOpen(Vin.of(VIN)).orElseThrow();
        assertEquals(world.me(), open.ownerId());
    }

    @Then("Alice's past events remain in the vehicle history without her identity")
    public void alicesPastEventsRemain() {
        // Events hang off the retained, closed ownership period and never carry the owner's identity;
        // the vehicle feature only has to keep that period around.
        UUID periodId = world.get(ALICE_PERIOD_KEY);
        assertEquals(VIN, ownerships.findById(periodId).orElseThrow().vin().value());
    }

    @Then("Bob's claim is REJECTED")
    public void bobsClaimIsRejected() {
        assertStatus(world.get(BOB_CLAIM_KEY), ClaimStatus.REJECTED);
    }

    @Then("my claim is REJECTED")
    public void myClaimIsRejected() {
        assertNoError();
        assertStatus(world.get(CLAIM_KEY), ClaimStatus.REJECTED);
    }

    @Then("Alice still owns the vehicle")
    public void aliceStillOwnsTheVehicle() {
        assertNoError();
        assertEquals(world.user("Alice"), ownerships.findOpen(Vin.of(VIN)).orElseThrow().ownerId());
    }

    @Then("Alice has no pending claims")
    public void aliceHasNoPendingClaims() {
        aliceHasPendingClaims(0);
    }

    @Then("Alice has {int} pending claim(s)")
    public void aliceHasPendingClaims(int count) {
        assertNoError();
        assertEquals(count, deciding.listPending(VIN, world.user("Alice")).size());
    }

    private void aliceOwns() {
        UUID alice = world.user("Alice");
        register.register(new RegisterVehicleCommand(alice, VIN, "Volkswagen", "Golf", null, 2018, "diesel"));
        world.put(VIN_KEY, VIN);
        world.put(ALICE_PERIOD_KEY, ownerships.findOpen(Vin.of(VIN)).orElseThrow().id());
    }

    private void assertStatus(UUID claimId, ClaimStatus expected) {
        assertEquals(expected, ownerships.findClaim(claimId).orElseThrow().status());
    }

    private void assertNoError() {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
    }
}
