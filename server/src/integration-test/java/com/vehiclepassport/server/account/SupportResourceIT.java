package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class SupportResourceIT {

    static final String USER = "00000000-0000-0000-0000-00000000c001";

    @Inject
    EntityManager em;

    private static final String DIAG = "{\"appVersion\":\"1.2.3\",\"platform\":\"ios\",\"osVersion\":\"18.1\","
            + "\"deviceModel\":\"iPhone 15\"}";

    private static String body(String message, boolean include, String diagnostics) {
        return "{\"kind\":\"problem\",\"message\":\"" + message + "\",\"includeDiagnostics\":" + include
                + (diagnostics == null ? "" : ",\"diagnostics\":" + diagnostics) + "}";
    }

    private Object stored(String id, String column) {
        return QuarkusTransaction.requiringNew().call(() -> em.createNativeQuery(
                "select " + column + " from vehicle_passport.support_report where id = :id")
                .setParameter("id", UUID.fromString(id)).getSingleResult());
    }

    @Test
    @TestSecurity(user = "c001")
    @OidcSecurity(claims = @Claim(key = "sub", value = USER))
    void createsReportAndReturns201WithId() {
        String id = given().contentType(ContentType.JSON)
                .body(body("The scan screen freezes after upload.", true, DIAG))
                .when().post("/support/reports")
                .then().statusCode(201).body("id", notNullValue())
                .extract().path("id");
        assertEquals(USER, stored(id, "user_id").toString());
        assertEquals("problem", stored(id, "kind"));
        assertEquals("iPhone 15", stored(id, "diagnostics->>'deviceModel'"));
    }

    @Test
    @TestSecurity(user = "c001")
    @OidcSecurity(claims = @Claim(key = "sub", value = USER))
    void diagnosticsDroppedWhenFlagFalse() {
        String id = given().contentType(ContentType.JSON)
                .body(body("Question about transfers please.", false, DIAG))
                .when().post("/support/reports")
                .then().statusCode(201).extract().path("id");
        assertNull(stored(id, "diagnostics"));
    }

    @Test
    @TestSecurity(user = "c001")
    @OidcSecurity(claims = @Claim(key = "sub", value = USER))
    void invalidBodiesAre400() {
        given().contentType(ContentType.JSON).body(body("too short", false, null)).when().post("/support/reports")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
        given().contentType(ContentType.JSON).body(body("x".repeat(4001), false, null)).when()
                .post("/support/reports").then().statusCode(400).body("code", equalTo("validation-failed"));
        given().contentType(ContentType.JSON).body("{\"kind\":\"rant\",\"message\":\"a long enough message\","
                + "\"includeDiagnostics\":false}").when().post("/support/reports")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
        given().contentType(ContentType.JSON).body("{\"kind\":\"problem\",\"message\":\"a long enough message\"}")
                .when().post("/support/reports").then().statusCode(400);
    }

    @Test
    void requiresAuth() {
        given().contentType(ContentType.JSON).body(body("The scan screen freezes.", false, null)).when()
                .post("/support/reports").then().statusCode(401);
    }
}
