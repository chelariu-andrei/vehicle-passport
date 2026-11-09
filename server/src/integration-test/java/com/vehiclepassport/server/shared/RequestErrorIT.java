package com.vehiclepassport.server.shared;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.startsWith;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.response.ValidatableResponse;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
@TestSecurity(user = "req")
@OidcSecurity(claims = @Claim(key = "sub", value = "00000000-0000-0000-0000-0000000000a1"))
class RequestErrorIT {

    private static final String VIN = "WVWZZZ1JZXW000001";
    private static final String ID = "00000000-0000-0000-0000-000000000001";

    private static RequestSpecification json() {
        return given().contentType("application/json");
    }

    private static void assertValidationFailed(ValidatableResponse r) {
        r.statusCode(400).contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed")).body("status", equalTo(400));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null"})
    void required_body_empty_or_null_on_post_vehicles(String body) {
        assertValidationFailed(json().body(body).when().post("/vehicles").then());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null"})
    void required_body_empty_or_null_on_patch_vehicle(String body) {
        assertValidationFailed(json().body(body).when().patch("/vehicles/" + VIN).then());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null"})
    void required_body_empty_or_null_on_add_event(String body) {
        assertValidationFailed(json().body(body).when().post("/vehicles/" + VIN + "/events").then());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null"})
    void required_body_empty_or_null_on_edit_event(String body) {
        assertValidationFailed(json().body(body).when().put("/vehicles/" + VIN + "/events/" + ID).then());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "null"})
    void required_body_empty_or_null_on_confirm_scan(String body) {
        assertValidationFailed(json().body(body).when().post("/scans/" + ID + "/confirm").then());
    }

    @Test
    void malformed_json_is_problem_json() {
        assertValidationFailed(json().body("{\"vin\":").when().post("/vehicles").then());
        assertValidationFailed(json().body("not json").when().post("/vehicles/" + VIN + "/events").then());
    }

    @Test
    void bad_date_is_problem_json() {
        assertValidationFailed(json().body("{\"type\":\"SERVICE\",\"date\":\"yesterday\",\"odometerKm\":1,"
                + "\"costAmount\":1,\"currency\":\"RON\"}").when().post("/vehicles/" + VIN + "/events").then());
    }

    @Test
    void non_uuid_path_id_is_problem_json() {
        assertValidationFailed(given().when().get("/scans/not-a-uuid").then());
        assertValidationFailed(given().when().delete("/vehicles/" + VIN + "/events/not-a-uuid").then());
        assertValidationFailed(given().when().post("/vehicles/" + VIN + "/claims/nope/approve").then());
    }

    @Test
    void unknown_field_is_problem_json() {
        assertValidationFailed(json().body("{\"vin\":\"" + VIN + "\",\"make\":\"A\",\"model\":\"B\",\"year\":2020,"
                + "\"fuel\":\"DIESEL\",\"colour\":\"red\"}").when().post("/vehicles").then());
    }
}
