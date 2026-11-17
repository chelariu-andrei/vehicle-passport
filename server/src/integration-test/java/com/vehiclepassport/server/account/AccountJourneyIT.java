package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Test;

/** One signed-in user's whole account lifecycle, with the consent gate switched on. */
@QuarkusTest
@TestProfile(ConsentGateProfile.class)
class AccountJourneyIT {

    static final String NEWCOMER = "00000000-0000-0000-0000-00000000f901";

    @Test
    @TestSecurity(user = "f901")
    @OidcSecurity(claims = @Claim(key = "sub", value = NEWCOMER))
    void newUserConsentsUsesTheAppAndSchedulesThenCancelsDeletion() {
        given().when().get("/vehicles")
                .then().statusCode(403)
                .contentType("application/problem+json")
                .body("code", equalTo("consent-required"));

        JsonPath legal = given().when().get("/public/legal/documents")
                .then().statusCode(200).extract().jsonPath();
        String terms = legal.getString("documents.find { it.type == 'terms' }.version");
        String privacy = legal.getString("documents.find { it.type == 'privacy' }.version");
        given().contentType(ContentType.JSON)
                .body("{\"accept\":[{\"type\":\"terms\",\"version\":\"" + terms + "\"},"
                        + "{\"type\":\"privacy\",\"version\":\"" + privacy + "\"}],\"source\":\"sign-up-form\"}")
                .when().post("/me/consents")
                .then().statusCode(200).body("required", equalTo(false));

        given().when().get("/vehicles").then().statusCode(200);

        given().contentType(ContentType.JSON).body("{\"displayName\":\"Journey User\"}")
                .when().patch("/me")
                .then().statusCode(200).body("displayName", equalTo("Journey User"));

        given().contentType(ContentType.JSON)
                .body("{\"language\":\"ro\",\"appearance\":\"dark\",\"units\":{\"distance\":\"km\","
                        + "\"currency\":\"EUR\"},\"notifications\":{\"documentDeadlines\":true,\"reminderDays\":[7],"
                        + "\"tireSeason\":true,\"activityScans\":true,\"activityPassportViews\":false,"
                        + "\"activityTransfers\":true,\"productNews\":false}}")
                .when().put("/me/settings")
                .then().statusCode(200).body("language", equalTo("ro")).body("units.currency", equalTo("EUR"));

        given().when().post("/me/deletion").then().statusCode(201).body("scheduledFor", notNullValue());
        given().when().get("/me")
                .then().statusCode(200)
                .body("displayName", equalTo("Journey User"))
                .body("consent.required", equalTo(false))
                .body("deletion.scheduledFor", notNullValue());

        given().when().delete("/me/deletion").then().statusCode(204);
        given().when().get("/me").then().statusCode(200).body("deletion", nullValue());
    }
}
