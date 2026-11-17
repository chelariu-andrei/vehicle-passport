package com.vehiclepassport.server.fuel;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.startsWith;

import com.vehiclepassport.server.account.ConsentGateProfile;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import org.junit.jupiter.api.Test;

/**
 * The consent gate on the fuel routes. Kept apart from {@link FuelResourceIT} because the gate needs its own
 * profile (every other IT runs with it off), the same one {@code ConsentGateIT} uses.
 */
@QuarkusTest
@TestProfile(ConsentGateProfile.class)
class FuelConsentGateIT {

    static final String NO_CONSENT = "00000000-0000-0000-0000-0000000000f9";
    static final String VIN = "WVWZZZ1JZXW000001";

    @Test
    @TestSecurity(user = "f9")
    @OidcSecurity(claims = @Claim(key = "sub", value = NO_CONSENT))
    void post_without_consent_is_403_consent_required() {
        given().contentType("application/json")
                .body("{\"date\":\"2025-10-01\",\"odometerKm\":10000,\"fuelType\":\"DIESEL\",\"quantity\":40,"
                        + "\"total\":300,\"currency\":\"RON\"}")
                .when().post("/vehicles/" + VIN + "/fuel-entries")
                .then().statusCode(403)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("consent-required"));
        given().when().get("/vehicles/" + VIN + "/fuel-entries")
                .then().statusCode(403).body("code", equalTo("consent-required"));
        given().when().get("/vehicles/" + VIN + "/fuel/stats")
                .then().statusCode(403).body("code", equalTo("consent-required"));
    }
}
