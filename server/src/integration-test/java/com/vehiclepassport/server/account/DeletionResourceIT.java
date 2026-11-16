package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class DeletionResourceIT {

    static final String USER = "00000000-0000-0000-0000-00000000a101";
    static final String NEVER = "00000000-0000-0000-0000-00000000a102";

    @Test
    @TestSecurity(user = "a101")
    @OidcSecurity(claims = @Claim(key = "sub", value = USER))
    void scheduleShowsInMeSecondCallConflictsAndCancelClears() {
        given().when().post("/me/deletion")
                .then().statusCode(201).body("scheduledFor", notNullValue());
        given().when().get("/me").then().statusCode(200).body("deletion.scheduledFor", notNullValue());

        given().when().post("/me/deletion")
                .then().statusCode(409)
                .contentType("application/problem+json")
                .body("code", equalTo("deletion-already-scheduled"));

        given().when().delete("/me/deletion").then().statusCode(204);
        given().when().get("/me").then().statusCode(200).body("deletion", nullValue());

        given().when().delete("/me/deletion")
                .then().statusCode(404).body("code", equalTo("deletion-not-scheduled"));
    }

    @Test
    @TestSecurity(user = "a102")
    @OidcSecurity(claims = @Claim(key = "sub", value = NEVER))
    void cancelWithoutAnyAccountRecordIs404() {
        given().when().delete("/me/deletion").then().statusCode(404).body("code", equalTo("deletion-not-scheduled"));
    }

    @Test
    void deletionRequiresAuth() {
        given().when().post("/me/deletion").then().statusCode(401);
        given().when().delete("/me/deletion").then().statusCode(401);
    }
}
