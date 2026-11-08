package com.vehiclepassport.server.shared;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.startsWith;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestSecurity(user = "validation")
class ValidationIT {

    @Test
    void invalid_body_is_problem_json_validation_failed() {
        given().contentType("application/json").body("{\"name\":\"\"}")
                .when().post("/test/validate")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"))
                .body("status", equalTo(400));
    }
}
