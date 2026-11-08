package com.vehiclepassport.server.testsupport.smoke;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.vehiclepassport.server.testsupport.World;
import io.cucumber.java.en.Then;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class SmokeSteps {

    @Inject
    World world;

    @Then("the harness is alive")
    public void theHarnessIsAlive() {
        assertNotNull(world);
    }
}
