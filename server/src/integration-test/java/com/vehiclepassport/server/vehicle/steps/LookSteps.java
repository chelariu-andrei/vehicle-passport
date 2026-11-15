package com.vehiclepassport.server.vehicle.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.vehicle.application.port.in.AppearanceView;
import com.vehiclepassport.server.vehicle.application.port.in.GetVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.UpdateVehicleUseCase.UpdateVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.VehicleView;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.UUID;

/** Plate and look on the vehicle. Shares the "garage.vin" key with {@link GarageSteps}. */
@ApplicationScoped
public class LookSteps {

    static final String VIN_KEY = "garage.vin";
    private static final String DEFAULT_VIN = "WVWZZZ1JZXW000001";
    private static final String LOOK_KEY = "look.before";

    @Inject
    World world;
    @Inject
    RegisterVehicleUseCase register;
    @Inject
    GetVehicleUseCase get;
    @Inject
    UpdateVehicleUseCase update;
    @Inject
    ReleaseVehicleUseCase release;

    @Given("my vehicle has the look {word} {word} {word} {word} {word} {word} with a black roof")
    public void myVehicleHasTheLook(String body, String color, String finish, String wheels, String rims,
            String tint) {
        styleAs(world.me(), myVin(), null, false, look(body, color, finish, wheels, rims, tint));
    }

    @Given("my vehicle has plate {string}")
    public void myVehicleHasPlate(String plate) {
        styleAs(world.me(), myVin(), plate, true, null);
    }

    @Given("my vehicle has plate {string} and the look {word} {word} {word} {word} {word} {word} with a black roof")
    public void myVehicleHasPlateAndLook(String plate, String body, String color, String finish, String wheels,
            String rims, String tint) {
        styleAs(world.me(), myVin(), plate, true, look(body, color, finish, wheels, rims, tint));
    }

    @Given("Alice's vehicle has plate {string} and the look {word} {word} {word} {word} {word} {word} with a black roof")
    public void alicesVehicleHasPlateAndLook(String plate, String body, String color, String finish, String wheels,
            String rims, String tint) {
        styleAs(world.user("Alice"), alicesVin(), plate, true, look(body, color, finish, wheels, rims, tint));
    }

    @Given("Alice's vehicle has plate {string}")
    public void alicesVehicleHasPlate(String plate) {
        styleAs(world.user("Alice"), alicesVin(), plate, true, null);
    }

    @Given("Alice released it")
    public void aliceReleasedIt() {
        release.release(world.get(VIN_KEY), world.user("Alice"));
    }

    @Then("Alice's vehicle still has plate {string}")
    public void alicesVehicleStillHasPlate(String plate) {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
        assertEquals(plate, get.get(world.get(VIN_KEY), world.user("Alice")).plate());
    }

    @When("I save the look {word} {word} {word} {word} {word} {word} with a black roof and plate {string}")
    public void iSaveTheLookAndPlate(String body, String color, String finish, String wheels, String rims,
            String tint, String plate) {
        attempt(plate, true, look(body, color, finish, wheels, rims, tint));
    }

    @When("I save only the colour {string}")
    public void iSaveOnlyTheColour(String color) {
        attempt(null, false, new AppearanceView(null, color, null, null, null, null, null, null));
    }

    @When("I save the plate {string}")
    public void iSaveThePlate(String plate) {
        attempt(plate, true, null);
    }

    @When("I clear the plate")
    public void iClearThePlate() {
        attempt(null, true, null);
    }

    @Then("my vehicle has no plate and no look")
    public void myVehicleHasNoPlateAndNoLook() {
        VehicleView v = mine();
        assertNull(v.plate());
        assertNull(v.appearance());
    }

    @Then("my vehicle has no plate")
    public void myVehicleHasNoPlate() {
        assertNull(mine().plate());
    }

    @Then("my vehicle has plate {string} and body type {string} and colour {string}")
    public void myVehicleHasPlateBodyAndColour(String plate, String body, String color) {
        VehicleView v = mine();
        assertEquals(plate, v.plate());
        myVehicleHasBodyAndColour(body, color);
    }

    @Then("my vehicle has body type {string} and colour {string}")
    public void myVehicleHasBodyAndColour(String body, String color) {
        AppearanceView a = mine().appearance();
        assertEquals(body, a.bodyType());
        assertEquals(color, a.color());
    }

    @Then("my vehicle's look is exactly colour {string}")
    public void myVehiclesLookIsExactlyColour(String color) {
        assertEquals(new AppearanceView(null, color, null, null, null, null, null, null), mine().appearance());
    }

    /** Registers the default VIN for Alice when no step has named a vehicle yet. */
    private String alicesVin() {
        String vin = world.get(VIN_KEY);
        if (vin == null) {
            vin = DEFAULT_VIN;
            register.register(new RegisterVehicleCommand(world.user("Alice"), vin, "Volkswagen", "Golf", null, 2018,
                    "diesel"));
            world.put(VIN_KEY, vin);
        }
        return vin;
    }

    /** Registers the default VIN for me when no step has named a vehicle yet. */
    String myVin() {
        String vin = world.get(VIN_KEY);
        if (vin == null) {
            vin = DEFAULT_VIN;
            register.register(new RegisterVehicleCommand(world.me(), vin, "Volkswagen", "Golf", null, 2018, "diesel"));
            world.put(VIN_KEY, vin);
        }
        return vin;
    }

    void styleAs(UUID user, String vin, String plate, boolean plateGiven, AppearanceView look) {
        VehicleView v = get.get(vin, user);
        update.update(new UpdateVehicleCommand(user, vin, v.make(), v.model(), v.engine(), v.year(), v.fuel(),
                plateGiven, plate, look));
    }

    static AppearanceView look(String body, String color, String finish, String wheels, String rims, String tint) {
        return new AppearanceView(body, color, null, finish, wheels, rims, tint, true);
    }

    private void attempt(String plate, boolean plateGiven, AppearanceView look) {
        String vin = world.get(VIN_KEY);
        world.attempt(() -> update.update(new UpdateVehicleCommand(world.me(), vin, "Volkswagen", "Golf", null, 2018,
                "diesel", plateGiven, plate, look)));
    }

    private VehicleView mine() {
        RuntimeException error = world.lastError();
        if (error != null) {
            throw new AssertionError("unexpected failure: " + error, error);
        }
        return get.get(world.get(VIN_KEY), world.me());
    }
}
