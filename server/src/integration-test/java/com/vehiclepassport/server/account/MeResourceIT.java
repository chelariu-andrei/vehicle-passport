package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.account.application.port.in.GetMeUseCase;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventInput;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class MeResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000e1";
    static final String SECOND = "00000000-0000-0000-0000-0000000000e2";
    static final String NO_EMAIL = "00000000-0000-0000-0000-0000000000e3";
    static final String PATCHER = "00000000-0000-0000-0000-0000000000e4";
    static final String CLEARER = "00000000-0000-0000-0000-0000000000e5";
    static final String BAD_PHONE = "00000000-0000-0000-0000-0000000000e6";
    static final String BAD_NAME = "00000000-0000-0000-0000-0000000000e7";
    static final String COUNTER = "00000000-0000-0000-0000-0000000000e8";
    static final String BYSTANDER = "00000000-0000-0000-0000-0000000000e9";

    @Inject
    GetMeUseCase getMe;
    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AddEventUseCase adding;
    @Inject
    CreatePassportUseCase passports;
    @Inject
    EntityManager em;

    private static String randomVin() {
        String alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
        ThreadLocalRandom r = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(17);
        for (int i = 0; i < 17; i++) {
            sb.append(alphabet.charAt(r.nextInt(alphabet.length())));
        }
        return sb.toString();
    }

    private long rows(String userId) {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em
                .createNativeQuery("select count(*) from vehicle_passport.user_profile where id = :id")
                .setParameter("id", UUID.fromString(userId)).getSingleResult()).longValue());
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = {@Claim(key = "sub", value = ME), @Claim(key = "email", value = "me@example.com"),
            @Claim(key = "email_verified", value = "true")})
    void firstMeCallCreatesProfile() {
        given().when().get("/me")
                .then().statusCode(200)
                .body("id", equalTo(ME))
                .body("email", equalTo("me@example.com"))
                .body("emailVerified", equalTo(true))
                .body("displayName", nullValue())
                .body("phone", nullValue())
                .body("createdAt", notNullValue())
                .body("stats.vehicles", equalTo(0))
                .body("stats.events", equalTo(0))
                .body("stats.passports", equalTo(0))
                .body("deletion", nullValue())
                .body("consent.required", equalTo(true))
                .body("consent.terms.currentVersion", notNullValue())
                .body("consent.terms.acceptedVersion", nullValue())
                .body("consent.marketing", equalTo(false));
        assertEquals(1, rows(ME));
    }

    @Test
    @TestSecurity(user = "e2")
    @OidcSecurity(claims = {@Claim(key = "sub", value = SECOND), @Claim(key = "email", value = "two@example.com")})
    void secondCallReturnsSameRow() {
        String first = given().when().get("/me").then().statusCode(200).extract().path("createdAt");
        given().when().get("/me").then().statusCode(200).body("createdAt", equalTo(first));
        assertEquals(1, rows(SECOND));
    }

    @Test
    void concurrentFirstCallsCreateOneRow() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            for (int i = 0; i < 20; i++) {
                UUID user = UUID.randomUUID();
                CyclicBarrier start = new CyclicBarrier(2);
                List<Future<UUID>> calls = new ArrayList<>();
                for (int t = 0; t < 2; t++) {
                    calls.add(pool.submit(() -> {
                        start.await();
                        return getMe.get(user, "race@example.com", true).profile().id();
                    }));
                }
                for (Future<UUID> call : calls) {
                    assertEquals(user, call.get());
                }
                assertEquals(1, rows(user.toString()));
            }
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    @TestSecurity(user = "e3")
    @OidcSecurity(claims = @Claim(key = "sub", value = NO_EMAIL))
    void meWorksWithoutEmailClaim() {
        given().when().get("/me")
                .then().statusCode(200)
                .body("email", nullValue())
                .body("emailVerified", equalTo(false));
    }

    @Test
    @TestSecurity(user = "e4")
    @OidcSecurity(claims = @Claim(key = "sub", value = PATCHER))
    void patchSetsDisplayName() {
        given().contentType(ContentType.JSON).body("{\"displayName\":\"  Ana Pop \"}")
                .when().patch("/me")
                .then().statusCode(200)
                .body("displayName", equalTo("Ana Pop"))
                .body("phone", nullValue());
        given().when().get("/me").then().statusCode(200).body("displayName", equalTo("Ana Pop"));
    }

    @Test
    @TestSecurity(user = "e5")
    @OidcSecurity(claims = @Claim(key = "sub", value = CLEARER))
    void patchClearsPhoneWithNull() {
        given().contentType(ContentType.JSON).body("{\"phone\":\"+40712345678\",\"displayName\":\"Ion\"}")
                .when().patch("/me").then().statusCode(200).body("phone", equalTo("+40712345678"));
        // absent phone = unchanged
        given().contentType(ContentType.JSON).body("{\"displayName\":\"Ion 2\"}")
                .when().patch("/me").then().statusCode(200).body("phone", equalTo("+40712345678"));
        given().contentType(ContentType.JSON).body("{\"phone\":null}")
                .when().patch("/me")
                .then().statusCode(200)
                .body("phone", nullValue())
                .body("displayName", equalTo("Ion 2"));
    }

    @Test
    @TestSecurity(user = "e6")
    @OidcSecurity(claims = @Claim(key = "sub", value = BAD_PHONE))
    void patchRejectsPhoneWithSpaces() {
        given().contentType(ContentType.JSON).body("{\"phone\":\"+40 712 345 678\"}")
                .when().patch("/me")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "e7")
    @OidcSecurity(claims = @Claim(key = "sub", value = BAD_NAME))
    void patchRejectsNameOver80() {
        given().contentType(ContentType.JSON).body("{\"displayName\":\"" + "x".repeat(81) + "\"}")
                .when().patch("/me")
                .then().statusCode(400)
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "e8")
    @OidcSecurity(claims = @Claim(key = "sub", value = COUNTER))
    void statsCountOnlyOwnRecords() {
        UUID me = UUID.fromString(COUNTER);
        UUID other = UUID.fromString(BYSTANDER);
        String mine = randomVin();
        String mine2 = randomVin();
        String theirs = randomVin();
        registering.register(new RegisterVehicleCommand(me, mine, "Dacia", "Duster", null, 2020, "DIESEL"));
        registering.register(new RegisterVehicleCommand(me, mine2, "Dacia", "Logan", null, 2019, "PETROL"));
        registering.register(new RegisterVehicleCommand(other, theirs, "Dacia", "Sandero", null, 2018, "PETROL"));
        adding.add(new AddEventCommand(me, mine, new EventInput("SERVICE", LocalDate.parse("2025-03-01"), 1000,
                BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
        adding.add(new AddEventCommand(me, mine, new EventInput("SERVICE", LocalDate.parse("2025-04-01"), 2000,
                BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
        adding.add(new AddEventCommand(other, theirs, new EventInput("SERVICE", LocalDate.parse("2025-03-01"), 1000,
                BigDecimal.TEN, "RON", null, null, null, null, null, null, null)));
        passports.create(me, mine, null);
        passports.create(other, theirs, null);
        passports.create(other, theirs, null);

        given().when().get("/me")
                .then().statusCode(200)
                .body("stats.vehicles", equalTo(2))
                .body("stats.events", equalTo(2))
                .body("stats.passports", equalTo(1));
    }

    @Test
    void meRequiresAuth() {
        given().when().get("/me").then().statusCode(401);
    }
}
