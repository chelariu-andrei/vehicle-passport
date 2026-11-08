package com.vehiclepassport.server.vehicle.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.vehiclepassport.server.shared.error.DomainException;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.GetVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.ListMyVehiclesUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegistrationResult;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase.UpdateVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import com.vehiclepassport.server.vehicle.domain.exception.VehicleNotFoundException;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

@ApplicationScoped
public class GarageSteps {

    private static final String VIN_KEY = "garage.vin";
    private static final String RESULT_KEY = "garage.result";

    @Inject
    World world;

    @Inject
    RegisterVehicleUseCase register;

    @Inject
    ListMyVehiclesUseCase list;

    @Inject
    GetVehicleUseCase get;

    @Inject
    UpdateVehicleUseCase update;

    @Inject
    ReleaseVehicleUseCase release;

    @Inject
    AssertActiveOwnerUseCase assertOwner;

    @Given("I am an authenticated user")
    public void iAmAnAuthenticatedUser() {
        assertNotNull(world.me());
    }

    @Given("I own vehicle {string}")
    public void iOwnVehicle(String vin) {
        registerAs(world.me(), vin);
        world.put(VIN_KEY, vin);
    }

    @Given("vehicle {string} is owned by another user")
    public void vehicleIsOwnedByAnotherUser(String vin) {
        registerAs(world.user("Alice"), vin);
        world.put(VIN_KEY, vin);
    }

    @Given("Alice owned vehicle {string} and released it")
    public void aliceOwnedVehicleAndReleasedIt(String vin) {
        registerAs(world.user("Alice"), vin);
        release.release(vin, world.user("Alice"));
        world.put(VIN_KEY, vin);
    }

    @When("I register vehicle {string} {word} {word} {int} {word}")
    public void iRegisterVehicle(String vin, String make, String model, int year, String fuel) {
        world.put(VIN_KEY, vin);
        world.attempt(() -> world.put(RESULT_KEY,
            register.register(new RegisterVehicleCommand(world.me(), vin, make, model, null, year, fuel))));
    }

    @When("I register the same VIN")
    public void iRegisterTheSameVin() {
        String vin = world.get(VIN_KEY);
        iRegisterVehicle(vin, "Volkswagen", "Golf", 2018, "diesel");
    }

    @When("I fetch that vehicle")
    public void iFetchThatVehicle() {
        String vin = world.get(VIN_KEY);
        world.attempt(() -> get.get(vin, world.me()));
    }

    @When("I change its model to {string}")
    public void iChangeItsModelTo(String model) {
        String vin = world.get(VIN_KEY);
        world.attempt(() -> update.update(
            new UpdateVehicleCommand(world.me(), vin, "Volkswagen", model, null, 2018, "diesel")));
    }

    @Then("the vehicle exists in my garage")
    public void theVehicleExistsInMyGarage() {
        theVehicleExistsInMyGarage((String) world.get(VIN_KEY));
    }

    @Then("the vehicle {string} exists in my garage")
    public void theVehicleExistsInMyGarage(String vin) {
        assertNoError();
        assertTrue(list.list(world.me()).stream().map(VehicleView::vin).anyMatch(vin::equals),
            "garage should contain " + vin);
    }

    @Then("I have an open ownership period for it")
    public void iHaveAnOpenOwnershipPeriodForIt() {
        assertNoError();
        String vin = world.get(VIN_KEY);
        assertNotNull(assertOwner.assertActiveOwner(vin.toUpperCase(), world.me()).periodId());
    }

    @Then("no ownership is created")
    public void noOwnershipIsCreated() {
        assertNoError();
        RegistrationResult result = world.get(RESULT_KEY);
        assertInstanceOf(RegisterVehicleUseCase.ClaimFiled.class, result);
        String vin = world.get(VIN_KEY);
        assertThrows(VehicleNotFoundException.class, () -> assertOwner.assertActiveOwner(vin, world.me()));
        assertEquals(0, list.list(world.me()).size());
    }

    @Then("it is rejected with code {string}")
    public void itIsRejectedWithCode(String code) {
        RuntimeException error = world.lastError();
        assertNotNull(error, "expected a rejection with code " + code);
        DomainException domain = assertInstanceOf(DomainException.class, error);
        assertEquals(code, domain.code());
    }

    private void registerAs(UUID user, String vin) {
        register.register(new RegisterVehicleCommand(user, vin, "Volkswagen", "Golf", null, 2018, "diesel"));
    }

    private void assertNoError() {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
    }
}
