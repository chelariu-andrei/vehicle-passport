package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class LegalResourceIT {

    @Test
    void listReturnsCurrentVersionsOnlyAndNeedsNoToken() {
        given().when().get("/public/legal/documents")
                .then().statusCode(200)
                .body("documents", hasSize(3))
                .body("documents.type", org.hamcrest.Matchers.contains("terms", "privacy", "data-sharing"))
                .body("documents.version", org.hamcrest.Matchers.everyItem(equalTo("1.0")))
                .body("documents.locale", org.hamcrest.Matchers.everyItem(equalTo("en")))
                .body("documents[0].effectiveDate", org.hamcrest.Matchers.notNullValue());
    }

    @Test
    void getReturnsRomanianWhenRequested() {
        given().queryParam("locale", "ro").when().get("/public/legal/documents/terms")
                .then().statusCode(200)
                .body("type", equalTo("terms"))
                .body("locale", equalTo("ro"))
                .body("bodyMarkdown", containsString("PLACEHOLDER"));
    }

    @Test
    void getFallsBackToEnglishForUnknownLocale() {
        given().queryParam("locale", "fr").when().get("/public/legal/documents/privacy")
                .then().statusCode(200).body("locale", equalTo("en"));
    }

    @Test
    void getUnknownTypeIs404() {
        given().when().get("/public/legal/documents/cookies")
                .then().statusCode(404)
                .contentType("application/problem+json")
                .body("code", equalTo("legal-document-not-found"));
    }
}
