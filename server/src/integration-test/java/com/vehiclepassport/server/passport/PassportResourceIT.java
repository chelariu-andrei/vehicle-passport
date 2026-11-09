package com.vehiclepassport.server.passport;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class PassportResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000f2";
    static final String OTHER = "00000000-0000-0000-0000-0000000000f3";

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AssertActiveOwnerUseCase owners;
    @Inject
    AddEventUseCase adding;
    @Inject
    CreatePassportUseCase creating;

    private String vehicleOf(String user) {
        String vin = PassportFixtures.randomVin();
        UUID id = UUID.fromString(user);
        registering.register(new RegisterVehicleCommand(id, vin, "Dacia", "Duster", null, 2020, "DIESEL"));
        adding.add(new AddEventCommand(id, vin, "SERVICE", LocalDate.parse("2025-03-01"), 1000, BigDecimal.TEN,
                "RON", PassportFixtures.TRICKY_NOTES));
        return vin;
    }

    private String create(String vin) {
        return given().contentType(ContentType.JSON).body("{}")
                .when().post("/vehicles/" + vin + "/passports")
                .then().statusCode(201).extract().path("id");
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void create_201_with_public_url() {
        String vin = vehicleOf(ME);
        Instant expiry = Instant.now().plus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS);
        String body = given().contentType(ContentType.JSON).body(Map.of("expiresAt", expiry.toString()))
                .when().post("/vehicles/" + vin + "/passports")
                .then().statusCode(201)
                .body("id", notNullValue())
                .body("vin", equalTo(vin))
                .body("status", equalTo("ACTIVE"))
                .body("hash", org.hamcrest.Matchers.matchesPattern("[0-9a-f]{64}"))
                .body("createdAt", notNullValue())
                .body("publicUrl", startsWith("http"))
                .body("publicUrl", org.hamcrest.Matchers.containsString("/public/passports/"))
                .extract().asString();
        String url = io.restassured.path.json.JsonPath.from(body).getString("publicUrl");
        assertEquals(expiry, Instant.parse(io.restassured.path.json.JsonPath.from(body).getString("expiresAt")));
        given().when().get(url.substring(url.indexOf("/public/"))).then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void create_without_body_201_and_no_expiry() {
        String vin = vehicleOf(ME);
        given().when().post("/vehicles/" + vin + "/passports")
                .then().statusCode(201).body("expiresAt", nullValue());
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void foreign_vin_404() {
        String vin = vehicleOf(OTHER);
        given().contentType(ContentType.JSON).body("{}")
                .when().post("/vehicles/" + vin + "/passports")
                .then().statusCode(404).contentType(startsWith("application/problem+json"))
                .body("code", equalTo("vehicle-not-found"));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void past_expiry_422() {
        String vin = vehicleOf(ME);
        given().contentType(ContentType.JSON)
                .body(Map.of("expiresAt", Instant.now().minus(1, ChronoUnit.HOURS).toString()))
                .when().post("/vehicles/" + vin + "/passports")
                .then().statusCode(422).contentType(startsWith("application/problem+json"))
                .body("code", equalTo("expiry-in-past"));
    }

    @Test
    @TestSecurity(user = "f3")
    @OidcSecurity(claims = @Claim(key = "sub", value = OTHER))
    void list_mine_only() {
        String mine = create(vehicleOf(OTHER));
        String theirs = creating.create(UUID.fromString(ME), vehicleOf(ME), null).id().toString();
        given().when().get("/passports").then().statusCode(200)
                .body("id", org.hamcrest.Matchers.hasItem(mine))
                .body("id", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(theirs)));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void revoke_204_twice() {
        String id = create(vehicleOf(ME));
        given().when().post("/passports/" + id + "/revoke").then().statusCode(204);
        given().when().post("/passports/" + id + "/revoke").then().statusCode(204);
        given().when().get("/passports").then().body("find { it.id == '" + id + "' }.status", equalTo("REVOKED"));
    }

    @Test
    @TestSecurity(user = "f3")
    @OidcSecurity(claims = @Claim(key = "sub", value = OTHER))
    void foreign_passport_404_everywhere() {
        String foreign = UUID.randomUUID().toString();
        given().when().post("/passports/" + foreign + "/revoke").then().statusCode(404)
                .body("code", equalTo("passport-not-found"));
        given().when().get("/passports/" + foreign + "/pdf").then().statusCode(404);
        given().when().get("/passports/" + foreign + "/qr").then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void qr_is_png() {
        String id = create(vehicleOf(ME));
        byte[] png = given().when().get("/passports/" + id + "/qr")
                .then().statusCode(200).contentType("image/png").extract().asByteArray();
        assertArrayEquals(new byte[] {(byte) 0x89, 'P', 'N', 'G'}, java.util.Arrays.copyOf(png, 4));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void owner_pdf_200() {
        String id = create(vehicleOf(ME));
        byte[] pdf = given().when().get("/passports/" + id + "/pdf")
                .then().statusCode(200).contentType("application/pdf").extract().asByteArray();
        assertEquals("%PDF", new String(pdf, 0, 4, StandardCharsets.US_ASCII));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void owner_qr_and_pdf_keep_working_after_revoke() {
        String id = create(vehicleOf(ME));
        given().when().post("/passports/" + id + "/revoke").then().statusCode(204);
        given().when().get("/passports/" + id + "/qr").then().statusCode(200).contentType("image/png");
        given().when().get("/passports/" + id + "/pdf").then().statusCode(200).contentType("application/pdf");
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void owner_responses_expose_no_ownership_identifiers() {
        String vin = vehicleOf(ME);
        String period = owners.assertActiveOwner(vin, UUID.fromString(ME)).periodId().toString();
        String created = given().contentType(ContentType.JSON).body("{}")
                .when().post("/vehicles/" + vin + "/passports").then().statusCode(201).extract().asString();
        String listed = given().when().get("/passports").then().statusCode(200).extract().asString();
        for (String raw : new String[] {created, listed}) {
            org.junit.jupiter.api.Assertions.assertFalse(raw.contains(period));
            org.junit.jupiter.api.Assertions.assertFalse(raw.contains(ME));
            org.junit.jupiter.api.Assertions.assertFalse(raw.contains("createdBy"));
        }
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void create_with_lowercase_vin_201_for_the_canonical_vin() {
        String vin = vehicleOf(ME);
        given().contentType(ContentType.JSON).body("{}")
                .when().post("/vehicles/" + vin.toLowerCase() + "/passports")
                .then().statusCode(201).body("vin", equalTo(vin));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void misspelt_expiry_field_400_and_no_passport_created() {
        String vin = vehicleOf(ME);
        int before = given().when().get("/passports").then().statusCode(200).extract().jsonPath().getList("$").size();
        given().contentType(ContentType.JSON).body("{\"expiresat\":\"2030-01-01T00:00:00Z\"}")
                .when().post("/vehicles/" + vin + "/passports")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"));
        int after = given().when().get("/passports").then().statusCode(200).extract().jsonPath().getList("$").size();
        assertEquals(before, after);
    }
}
