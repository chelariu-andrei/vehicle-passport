package com.vehiclepassport.server.shared;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;

import io.quarkus.test.common.WithTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.oidc.server.OidcWiremockTestResource;
import io.smallrye.jwt.build.Jwt;
import io.smallrye.jwt.build.JwtClaimsBuilder;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(AuthIT.AuthProfile.class)
@WithTestResource(OidcWiremockTestResource.class)
class AuthIT {

    public static class AuthProfile implements QuarkusTestProfile {
        @Override
        public String getConfigProfile() {
            return "auth";
        }
    }

    private static JwtClaimsBuilder claims() {
        return Jwt.claims().issuer("https://server.example.com").audience("authenticated");
    }

    private static String bearer(JwtClaimsBuilder claims) {
        return "Bearer " + claims.sign();
    }

    @Test
    void no_token_is_401() {
        given().when().get("/test/ping").then().statusCode(401);
    }

    @Test
    void valid_token_returns_sub() {
        String sub = UUID.randomUUID().toString();
        given().header("Authorization", bearer(claims().subject(sub)))
                .when().get("/test/ping")
                .then().statusCode(200).body(equalTo(sub));
    }

    @Test
    void token_without_sub_is_401() {
        given().header("Authorization", bearer(claims()))
                .when().get("/test/ping")
                .then().statusCode(401).body(not(containsString("Exception")));
    }

    @Test
    void token_with_aud_anon_is_401() {
        given().header("Authorization",
                        bearer(claims().audience("anon").subject(UUID.randomUUID().toString())))
                .when().get("/test/ping").then().statusCode(401);
    }

    @Test
    void token_with_non_uuid_sub_is_401() {
        given().header("Authorization", bearer(claims().subject("not-a-uuid")))
                .when().get("/test/ping")
                .then().statusCode(401).body(not(containsString("Exception")));
    }

    @Test
    void expired_token_is_401() {
        given().header("Authorization", bearer(claims().subject(UUID.randomUUID().toString())
                        .issuedAt(Instant.now().minusSeconds(600))
                        .expiresAt(Instant.now().minusSeconds(300))))
                .when().get("/test/ping").then().statusCode(401);
    }

    @Test
    void token_with_wrong_issuer_is_401() {
        given().header("Authorization", bearer(claims().issuer("https://evil.example.com")
                        .subject(UUID.randomUUID().toString())))
                .when().get("/test/ping").then().statusCode(401);
    }

    @Test
    void token_without_aud_is_401() {
        given().header("Authorization", bearer(
                        Jwt.claims().issuer("https://server.example.com").subject(UUID.randomUUID().toString())))
                .when().get("/test/ping").then().statusCode(401);
    }

    @Test
    void public_path_needs_no_token() {
        given().when().get("/public/test-ping").then().statusCode(200);
    }
}
