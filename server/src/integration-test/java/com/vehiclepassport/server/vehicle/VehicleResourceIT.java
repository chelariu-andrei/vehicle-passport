package com.vehiclepassport.server.vehicle;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.ClaimFiled;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class VehicleResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000a1";
    static final String OTHER = "00000000-0000-0000-0000-0000000000b2";
    static final String CLAIMANT = "00000000-0000-0000-0000-0000000000c3";
    static final String LISTER = "00000000-0000-0000-0000-0000000000d4";

    @Inject
    RegisterVehicleUseCase registering;

    private static String body(String vin) {
        return "{\"vin\":\"" + vin + "\",\"make\":\"Dacia\",\"model\":\"Duster\",\"year\":2020,\"fuel\":\"DIESEL\"}";
    }

    private RegisterVehicleUseCase.RegistrationResult registerAs(String user, String vin) {
        return registering.register(new RegisterVehicleCommand(UUID.fromString(user), vin, "Dacia", "Duster", null,
                2020, "DIESEL"));
    }

    @Test
    @TestSecurity(user = "u1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_new_vehicle_201() {
        String vin = TestVins.random();
        given().contentType(ContentType.JSON).body(body(vin))
                .when().post("/vehicles")
                .then().statusCode(201)
                .body("vin", equalTo(vin))
                .body("make", equalTo("Dacia"))
                .body("fuel", equalTo("DIESEL"))
                .body("engine", nullValue());
    }

    @Test
    @TestSecurity(user = "u2")
    @OidcSecurity(claims = @Claim(key = "sub", value = CLAIMANT))
    void post_owned_vin_202_with_claim_id() {
        String vin = TestVins.random();
        registerAs(OTHER, vin);
        given().contentType(ContentType.JSON).body(body(vin))
                .when().post("/vehicles")
                .then().statusCode(202)
                .body("claimId", notNullValue())
                .body("filedAt", notNullValue());
    }

    @Test
    @TestSecurity(user = "u3")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_own_vin_409_problem_json_code_already_owner() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        given().contentType(ContentType.JSON).body(body(vin))
                .when().post("/vehicles")
                .then().statusCode(409)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("already-owner"));
    }

    @Test
    @TestSecurity(user = "u4")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_bad_vin_400_code_invalid_vin() {
        given().contentType(ContentType.JSON).body(body("WVWZZZ1JZXW00OOOO"))
                .when().post("/vehicles")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("invalid-vin"));
    }

    @Test
    @TestSecurity(user = "u5")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_invalid_body_400_validation_failed() {
        given().contentType(ContentType.JSON).body("{\"make\":\"\",\"year\":1}")
                .when().post("/vehicles")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "u6")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_empty_body_400_validation_failed() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        given().contentType(ContentType.JSON).body("{}")
                .when().patch("/vehicles/" + vin)
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "u7")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void get_foreign_vehicle_404() {
        String vin = TestVins.random();
        registerAs(OTHER, vin);
        given().when().get("/vehicles/" + vin)
                .then().statusCode(404)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("vehicle-not-found"));
    }

    @Test
    @TestSecurity(user = "u8")
    @OidcSecurity(claims = @Claim(key = "sub", value = LISTER))
    void list_returns_only_mine() {
        String mine1 = TestVins.random();
        String mine2 = TestVins.random();
        String foreign = TestVins.random();
        registerAs(LISTER, mine1);
        registerAs(LISTER, mine2);
        registerAs(OTHER, foreign);
        given().when().get("/vehicles")
                .then().statusCode(200)
                .body("$", hasSize(2))
                .body("vin", hasItem(mine1))
                .body("vin", hasItem(mine2))
                .body("vin", not(hasItem(foreign)));
    }

    @Test
    @TestSecurity(user = "u9")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_updates_only_given_fields() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        given().contentType(ContentType.JSON).body("{\"model\":\"Sandero\",\"year\":2021}")
                .when().patch("/vehicles/" + vin)
                .then().statusCode(200)
                .body("make", equalTo("Dacia"))
                .body("model", equalTo("Sandero"))
                .body("year", equalTo(2021));
    }

    @Test
    @TestSecurity(user = "u10")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_foreign_404() {
        String vin = TestVins.random();
        registerAs(OTHER, vin);
        given().contentType(ContentType.JSON).body("{\"model\":\"Sandero\"}")
                .when().patch("/vehicles/" + vin)
                .then().statusCode(404)
                .body("code", equalTo("vehicle-not-found"));
    }

    @Test
    @TestSecurity(user = "u11")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void release_then_get_404() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        given().when().post("/vehicles/" + vin + "/release").then().statusCode(204);
        given().when().get("/vehicles/" + vin).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "u12")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void approve_transfers_ownership_204() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        ClaimFiled filed = assertInstanceOf(ClaimFiled.class, registerAs(CLAIMANT, vin));
        given().when().post("/vehicles/" + vin + "/claims/" + filed.claimId() + "/approve")
                .then().statusCode(204);
        given().when().get("/vehicles/" + vin).then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "u13")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void claims_list_has_no_claimant_field() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        registerAs(CLAIMANT, vin);
        given().when().get("/vehicles/" + vin + "/claims")
                .then().statusCode(200)
                .body("$", hasSize(1))
                .body("[0].claimId", notNullValue())
                .body("[0].filedAt", notNullValue())
                .body("[0].claimantId", nullValue())
                .body("[0].size()", equalTo(2));
    }

    @Test
    @TestSecurity(user = "u14")
    @OidcSecurity(claims = @Claim(key = "sub", value = CLAIMANT))
    void withdraw_route_statuses() {
        String vin = TestVins.random();
        registerAs(OTHER, vin);
        ClaimFiled filed = assertInstanceOf(ClaimFiled.class, registerAs(CLAIMANT, vin));
        given().when().post("/ownership-claims/" + filed.claimId() + "/withdraw").then().statusCode(204);
        given().when().post("/ownership-claims/" + filed.claimId() + "/withdraw")
                .then().statusCode(409).body("code", equalTo("claim-not-pending"));
        given().when().post("/ownership-claims/" + UUID.randomUUID() + "/withdraw")
                .then().statusCode(404).body("code", equalTo("claim-not-found"));
    }

    @Test
    @TestSecurity(user = "u15")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void reject_claim_204_then_409() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        ClaimFiled filed = assertInstanceOf(ClaimFiled.class, registerAs(CLAIMANT, vin));
        given().when().post("/vehicles/" + vin + "/claims/" + filed.claimId() + "/reject").then().statusCode(204);
        given().when().post("/vehicles/" + vin + "/claims/" + filed.claimId() + "/reject")
                .then().statusCode(409).body("code", equalTo("claim-not-pending"));
    }

    private static final String LOOK = "{\"plate\":\"B 123 ABC\",\"appearance\":"
            + "{\"bodyType\":\"SUV\",\"color\":\"BLUE\",\"finish\":\"MATTE\"}}";

    private static void patch(String vin, String body, int status) {
        given().contentType(ContentType.JSON).body(body).when().patch("/vehicles/" + vin).then().statusCode(status);
    }

    @Test
    @TestSecurity(user = "l1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_returns_null_plate_and_appearance() {
        given().contentType(ContentType.JSON).body(body(TestVins.random()))
                .when().post("/vehicles")
                .then().statusCode(201)
                .body("containsKey('plate')", equalTo(true))
                .body("plate", nullValue())
                .body("containsKey('appearance')", equalTo(true))
                .body("appearance", nullValue());
    }

    @Test
    @TestSecurity(user = "l2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_sets_plate_and_appearance_and_get_returns_them() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        given().contentType(ContentType.JSON).body(LOOK)
                .when().patch("/vehicles/" + vin)
                .then().statusCode(200)
                .body("plate", equalTo("B 123 ABC"))
                .body("appearance.bodyType", equalTo("SUV"));
        given().when().get("/vehicles/" + vin)
                .then().statusCode(200)
                .body("plate", equalTo("B 123 ABC"))
                .body("appearance.bodyType", equalTo("SUV"))
                .body("appearance.color", equalTo("BLUE"))
                .body("appearance.finish", equalTo("MATTE"))
                .body("appearance.containsKey('wheels')", equalTo(false))
                .body("appearance.size()", equalTo(3));
    }

    @Test
    @TestSecurity(user = "l3")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_null_plate_clears_it() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        patch(vin, LOOK, 200);
        patch(vin, "{\"plate\":null}", 200);
        given().when().get("/vehicles/" + vin)
                .then().statusCode(200)
                .body("plate", nullValue())
                .body("appearance.bodyType", equalTo("SUV"));
    }

    @Test
    @TestSecurity(user = "l4")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_other_field_keeps_plate_and_look() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        patch(vin, LOOK, 200);
        patch(vin, "{\"model\":\"Passat\"}", 200);
        given().when().get("/vehicles/" + vin)
                .then().statusCode(200)
                .body("model", equalTo("Passat"))
                .body("plate", equalTo("B 123 ABC"))
                .body("appearance.bodyType", equalTo("SUV"));
    }

    @Test
    @TestSecurity(user = "l5")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_appearance_only_keeps_plate_and_replaces_look() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        patch(vin, LOOK, 200);
        patch(vin, "{\"appearance\":{\"color\":\"RED\"}}", 200);
        given().when().get("/vehicles/" + vin)
                .then().statusCode(200)
                .body("plate", equalTo("B 123 ABC"))
                .body("appearance.color", equalTo("RED"))
                .body("appearance.size()", equalTo(1));
    }

    @Test
    @TestSecurity(user = "l6")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_plate_only_is_not_empty() {
        String vin = TestVins.random();
        registerAs(ME, vin);
        patch(vin, "{\"plate\":null}", 200);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "{\"plate\":\"b 123\"}",
        "{\"plate\":\"ABCDEFGHIJK\"}",
        "{\"plate\":\"\"}",
        "{\"appearance\":{\"bodyType\":\"BUGGY\"}}",
        "{\"appearance\":{\"colorHex\":\"red\"}}",
        "{\"appearance\":{\"extra\":1}}",
        "{\"appearance\":null}",
        "{\"appearance\":{\"contrastRoof\":\"yes\"}}"
    })
    @TestSecurity(user = "l7")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void patch_invalid_look_400(String body) {
        String vin = TestVins.random();
        registerAs(ME, vin);
        String response = given().contentType(ContentType.JSON).body(body)
                .when().patch("/vehicles/" + vin)
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", anyOf(equalTo("validation-failed"), equalTo("invalid-vehicle")))
                .extract().asString();
        assertFalse(response.contains("b 123"), response);
        assertFalse(response.contains("ABCDEFGHIJK"), response);
    }

    @Test
    @TestSecurity(user = "l8")
    @OidcSecurity(claims = @Claim(key = "sub", value = LISTER))
    void list_returns_plate_and_appearance() {
        String vin = TestVins.random();
        registerAs(LISTER, vin);
        patch(vin, LOOK, 200);
        given().when().get("/vehicles")
                .then().statusCode(200)
                .body("find { it.vin == '" + vin + "' }.plate", equalTo("B 123 ABC"))
                .body("find { it.vin == '" + vin + "' }.appearance.bodyType", equalTo("SUV"));
    }
}
