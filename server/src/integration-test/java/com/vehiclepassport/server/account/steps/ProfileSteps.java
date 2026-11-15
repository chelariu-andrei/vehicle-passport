package com.vehiclepassport.server.account.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.account.application.port.in.Me;
import com.vehiclepassport.server.account.application.port.in.ProfileChange;
import com.vehiclepassport.server.account.application.port.in.UpdateProfileUseCase;
import com.vehiclepassport.server.testsupport.World;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class ProfileSteps {

    private static final String EMAIL_KEY = "profile.email";
    private static final String ME_KEY = "profile.me";
    private static final String CREATED_KEY = "profile.created";

    @Inject
    World world;
    @Inject
    GetMeUseCase getMe;
    @Inject
    UpdateProfileUseCase updateProfile;
    @Inject
    RegisterVehicleUseCase register;

    @Given("I am a new user with email {string}")
    public void iAmANewUserWithEmail(String email) {
        world.put(EMAIL_KEY, email);
    }

    @Given("I am a new user without an email")
    public void iAmANewUserWithoutAnEmail() {
        world.put(EMAIL_KEY, null);
    }

    @Given("my phone number is {string}")
    public void myPhoneNumberIs(String phone) {
        world.put(ME_KEY, updateProfile.update(world.me(), new ProfileChange(Optional.empty(), Optional.of(phone))));
    }

    @Given("Alice owns vehicle {string}")
    public void aliceOwnsVehicle(String vin) {
        register.register(new RegisterVehicleCommand(world.user("Alice"), vin, "Dacia", "Logan", null, 2019,
                "PETROL"));
    }

    @When("I open my account")
    public void iOpenMyAccount() {
        Me me = getMe.get(world.me(), world.get(EMAIL_KEY), world.get(EMAIL_KEY) != null);
        world.put(ME_KEY, me);
        List<Instant> seen = world.get(CREATED_KEY) == null ? new ArrayList<>() : world.get(CREATED_KEY);
        seen.add(me.profile().createdAt());
        world.put(CREATED_KEY, seen);
    }

    @When("I set my display name to {string}")
    public void iSetMyDisplayNameTo(String name) {
        world.put(ME_KEY, updateProfile.update(world.me(), new ProfileChange(Optional.of(name), Optional.empty())));
    }

    @When("I set my phone number to {string}")
    public void iSetMyPhoneNumberTo(String phone) {
        world.attempt(() -> updateProfile.update(world.me(),
                new ProfileChange(Optional.empty(), Optional.of(phone))));
    }

    @When("I clear my phone number")
    public void iClearMyPhoneNumber() {
        world.put(ME_KEY, updateProfile.update(world.me(), new ProfileChange(Optional.empty(), Optional.of(""))));
    }

    @Then("my profile exists with email {string}")
    public void myProfileExistsWithEmail(String email) {
        Me me = world.get(ME_KEY);
        assertNotNull(me);
        assertEquals(email, me.profile().email());
    }

    @Then("my profile exists without an email")
    public void myProfileExistsWithoutAnEmail() {
        Me me = world.get(ME_KEY);
        assertNotNull(me);
        assertNull(me.profile().email());
    }

    @Then("I have no display name or phone")
    public void iHaveNoDisplayNameOrPhone() {
        Me me = world.get(ME_KEY);
        assertNull(me.profile().phone());
        assertNull(me.profile().displayName());
    }

    @Then("my display name is {string}")
    public void myDisplayNameIs(String name) {
        Me me = world.get(ME_KEY);
        assertEquals(name, me.profile().displayName().value());
    }

    @Then("the profile has the same creation time both times")
    public void theProfileHasTheSameCreationTimeBothTimes() {
        List<Instant> seen = world.get(CREATED_KEY);
        assertEquals(2, seen.size());
        assertEquals(seen.get(0), seen.get(1));
    }

    @Then("my account shows {int} vehicle and {int} events and {int} passports")
    public void myAccountShows(int vehicles, int events, int passports) {
        Me me = world.get(ME_KEY);
        assertEquals(vehicles, me.stats().vehicles());
        assertEquals(events, me.stats().events());
        assertEquals(passports, me.stats().passports());
    }
}
