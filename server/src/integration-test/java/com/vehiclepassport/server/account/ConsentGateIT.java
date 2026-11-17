package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(ConsentGateProfile.class)
class ConsentGateIT {

    static final String BLOCKED = "00000000-0000-0000-0000-0000000000d1";
    static final String OPEN = "00000000-0000-0000-0000-0000000000d2";
    static final String BUMPED = "00000000-0000-0000-0000-0000000000d3";
    static final String SUPPORT = "00000000-0000-0000-0000-0000000000d4";

    static final String ACCEPT_CURRENT = "{\"accept\":[{\"type\":\"terms\",\"version\":\"1.0\"},"
            + "{\"type\":\"privacy\",\"version\":\"1.0\"}],\"source\":\"sign-up-form\"}";

    @Inject
    EntityManager em;

    @Test
    @TestSecurity(user = "d1")
    @OidcSecurity(claims = @Claim(key = "sub", value = BLOCKED))
    void gateBlocksVehiclesUntilAccepted() {
        given().when().get("/vehicles")
                .then().statusCode(403)
                .contentType("application/problem+json")
                .body("code", equalTo("consent-required"));
        given().contentType(ContentType.JSON).body(ACCEPT_CURRENT).when().post("/me/consents")
                .then().statusCode(200).body("required", equalTo(false));
        given().when().get("/vehicles").then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "d1")
    @OidcSecurity(claims = @Claim(key = "sub", value = BLOCKED))
    void gateBlocksDeadlinesUntilAccepted() {
        given().when().get("/vehicles/WVWZZZ1JZXW000001/deadlines")
                .then().statusCode(403)
                .contentType("application/problem+json")
                .body("code", equalTo("consent-required"));
    }

    @Test
    @TestSecurity(user = "d2")
    @OidcSecurity(claims = @Claim(key = "sub", value = OPEN))
    void gateAllowsMeAndPublicWhileConsentIsRequired() {
        given().when().get("/me").then().statusCode(200).body("consent.required", equalTo(true));
        given().when().get("/me/settings").then().statusCode(200);
        given().when().get("/me/consents").then().statusCode(200);
        given().when().get("/public/legal/documents").then().statusCode(200);
    }

    @Test
    @TestSecurity(user = "d4")
    @OidcSecurity(claims = @Claim(key = "sub", value = SUPPORT))
    void supportWorksWhileConsentIsRequired() {
        given().contentType(ContentType.JSON)
                .body("{\"kind\":\"question\",\"message\":\"How do I accept the new terms?\","
                        + "\"includeDiagnostics\":false}")
                .when().post("/support/reports").then().statusCode(201);
    }

    @Test
    void gateLeavesUnauthenticatedRequestsTo401() {
        given().when().get("/vehicles").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "d3")
    @OidcSecurity(claims = @Claim(key = "sub", value = BUMPED))
    void bumpingTermsVersionRequiresReconsent() {
        given().contentType(ContentType.JSON).body(ACCEPT_CURRENT).when().post("/me/consents").then().statusCode(200);
        given().when().get("/vehicles").then().statusCode(200);
        setTermsVersion("1.0", "2.0");
        try {
            given().when().get("/vehicles").then().statusCode(403).body("code", equalTo("consent-required"));
            given().contentType(ContentType.JSON).body(ACCEPT_CURRENT).when().post("/me/consents")
                    .then().statusCode(409).body("code", equalTo("consent-version-outdated"));
        } finally {
            setTermsVersion("2.0", "1.0");
        }
    }

    /** Flips which terms version is current for every locale, as a release of new legal text would. */
    private void setTermsVersion(String from, String to) {
        QuarkusTransaction.requiringNew().run(() -> {
            if (to.equals("2.0")) {
                em.createNativeQuery("insert into vehicle_passport.legal_document "
                        + "select type, locale, '2.0', title, body_markdown, effective_date, false "
                        + "from vehicle_passport.legal_document where type = 'terms' and version = '1.0'")
                        .executeUpdate();
            }
            em.createNativeQuery("update vehicle_passport.legal_document set is_current = false "
                    + "where type = 'terms' and version = :from").setParameter("from", from).executeUpdate();
            em.createNativeQuery("update vehicle_passport.legal_document set is_current = true "
                    + "where type = 'terms' and version = :to").setParameter("to", to).executeUpdate();
            if (to.equals("1.0")) {
                em.createNativeQuery("delete from vehicle_passport.legal_document "
                        + "where type = 'terms' and version = '2.0'").executeUpdate();
            }
        });
    }
}
