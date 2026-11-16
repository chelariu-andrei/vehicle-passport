package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class ConsentResourceIT {

    static final String FRESH = "00000000-0000-0000-0000-0000000000e1";
    static final String ACCEPTER = "00000000-0000-0000-0000-0000000000e2";
    static final String STALE = "00000000-0000-0000-0000-0000000000e3";
    static final String TOGGLER = "00000000-0000-0000-0000-0000000000e4";
    static final String ISO_A = "00000000-0000-0000-0000-0000000000e5";
    static final String ISO_B = "00000000-0000-0000-0000-0000000000e6";
    static final String BAD = "00000000-0000-0000-0000-0000000000e7";

    static String accept(String terms, String privacy) {
        return "{\"accept\":[{\"type\":\"terms\",\"version\":\"" + terms + "\"},{\"type\":\"privacy\",\"version\":\""
                + privacy + "\"}],\"source\":\"social-sign-up\"}";
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = FRESH))
    void newUserIsConsentRequiredAndGateIsOffByConfig() {
        given().when().get("/me/consents").then().statusCode(200)
                .body("required", equalTo(true))
                .body("terms.currentVersion", equalTo("1.0"))
                .body("terms.acceptedVersion", nullValue())
                .body("marketing", equalTo(false))
                .body("analytics", equalTo(false));
        given().when().get("/vehicles").then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "e2")
    @OidcSecurity(claims = @Claim(key = "sub", value = ACCEPTER))
    void acceptingCurrentVersionsClearsRequiredAndShowsInMe() {
        given().contentType(ContentType.JSON).body(accept("1.0", "1.0")).when().post("/me/consents")
                .then().statusCode(200)
                .body("required", equalTo(false))
                .body("terms.acceptedVersion", equalTo("1.0"))
                .body("privacy.acceptedVersion", equalTo("1.0"));
        given().when().get("/me").then().statusCode(200).body("consent.required", equalTo(false));
    }

    @Test
    @TestSecurity(user = "e3")
    @OidcSecurity(claims = @Claim(key = "sub", value = STALE))
    void acceptingOldVersionIs409() {
        given().contentType(ContentType.JSON).body(accept("0.9", "1.0")).when().post("/me/consents")
                .then().statusCode(409)
                .contentType("application/problem+json")
                .body("code", equalTo("consent-version-outdated"));
        given().when().get("/me/consents/history").then().statusCode(200).body("items", hasSize(0));
    }

    @Test
    @TestSecurity(user = "e4")
    @OidcSecurity(claims = @Claim(key = "sub", value = TOGGLER))
    void togglesAreRecordedInOrderedHistory() {
        given().contentType(ContentType.JSON).body("{\"marketing\":true,\"source\":\"settings\"}")
                .when().post("/me/consents").then().statusCode(200).body("marketing", equalTo(true));
        given().contentType(ContentType.JSON).body("{\"marketing\":false,\"source\":\"settings\"}")
                .when().post("/me/consents").then().statusCode(200).body("marketing", equalTo(false));
        given().contentType(ContentType.JSON).body("{\"analytics\":true,\"source\":\"settings\"}")
                .when().post("/me/consents").then().statusCode(200)
                .body("marketing", equalTo(false)).body("analytics", equalTo(true));
        given().when().get("/me/consents/history").then().statusCode(200)
                .body("items", hasSize(3))
                .body("items[0].granted", equalTo(true))
                .body("items[1].type", equalTo("marketing"))
                .body("items[1].granted", equalTo(false))
                .body("items[2].version", nullValue())
                .body("items.source", contains("settings", "settings", "settings"));
    }

    @Test
    @TestSecurity(user = "e5")
    @OidcSecurity(claims = @Claim(key = "sub", value = ISO_A))
    void consentsAreIsolatedPerUserA() {
        given().contentType(ContentType.JSON).body(accept("1.0", "1.0")).when().post("/me/consents").then()
                .statusCode(200);
    }

    @Test
    @TestSecurity(user = "e6")
    @OidcSecurity(claims = @Claim(key = "sub", value = ISO_B))
    void consentsAreIsolatedPerUserB() {
        given().when().get("/me/consents/history").then().statusCode(200).body("items", hasSize(0));
        given().when().get("/me/consents").then().statusCode(200).body("required", equalTo(true));
    }

    @Test
    @TestSecurity(user = "e7")
    @OidcSecurity(claims = @Claim(key = "sub", value = BAD))
    void invalidBodiesAre400() {
        given().contentType(ContentType.JSON).body("{\"source\":\"nowhere\"}").when().post("/me/consents")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
        given().contentType(ContentType.JSON).body("{\"accept\":[{\"type\":\"marketing\",\"version\":\"1.0\"}],"
                + "\"source\":\"settings\"}").when().post("/me/consents")
                .then().statusCode(400).body("code", equalTo("validation-failed"));
        given().contentType(ContentType.JSON).body("{\"source\":\"settings\",\"extra\":1}").when().post("/me/consents")
                .then().statusCode(400);
        given().contentType(ContentType.JSON).body("{}").when().post("/me/consents").then().statusCode(400);
    }

    @Test
    void consentsRequireAuth() {
        given().when().get("/me/consents").then().statusCode(401);
        given().contentType(ContentType.JSON).body("{\"source\":\"settings\"}").when().post("/me/consents")
                .then().statusCode(401);
        given().when().get("/me/consents/history").then().statusCode(401);
    }
}
