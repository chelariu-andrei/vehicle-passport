package com.vehiclepassport.server.account;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.vehiclepassport.server.account.application.port.in.GetSettingsUseCase;
import com.vehiclepassport.server.account.domain.model.Settings;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class SettingsResourceIT {

    static final String NEWBIE = "00000000-0000-0000-0000-0000000000f1";
    static final String WRITER = "00000000-0000-0000-0000-0000000000f2";
    static final String BAD_LANG = "00000000-0000-0000-0000-0000000000f3";
    static final String BAD_DAYS = "00000000-0000-0000-0000-0000000000f4";
    static final String UNKNOWN = "00000000-0000-0000-0000-0000000000f5";
    static final String ISO_A = "00000000-0000-0000-0000-0000000000f6";
    static final String ISO_B = "00000000-0000-0000-0000-0000000000f7";

    @Inject
    EntityManager em;
    @Inject
    GetSettingsUseCase getting;

    private static String body(String language, String days) {
        return "{\"language\":\"" + language + "\",\"appearance\":\"dark\",\"units\":{\"distance\":\"mi\","
                + "\"currency\":\"EUR\"},\"notifications\":{\"documentDeadlines\":false,\"reminderDays\":" + days
                + ",\"tireSeason\":false,\"activityScans\":false,\"activityPassportViews\":true,\"activityTransfers\":false,"
                + "\"productNews\":true}}";
    }

    private long rows(String userId) {
        return QuarkusTransaction.requiringNew().call(() -> ((Number) em
                .createNativeQuery("select count(*) from vehicle_passport.user_settings where user_id = :id")
                .setParameter("id", UUID.fromString(userId)).getSingleResult()).longValue());
    }

    @Test
    @TestSecurity(user = "f1")
    @OidcSecurity(claims = @Claim(key = "sub", value = NEWBIE))
    void getReturnsDefaultsForNewUser() {
        given().when().get("/me/settings")
                .then().statusCode(200)
                .body("language", equalTo("system"))
                .body("appearance", equalTo("system"))
                .body("units.distance", equalTo("km"))
                .body("units.currency", equalTo("RON"))
                .body("notifications.documentDeadlines", equalTo(true))
                .body("notifications.reminderDays", contains(30, 7, 1))
                .body("notifications.tireSeason", equalTo(true))
                .body("notifications.productNews", equalTo(false));
        assertEquals(0, rows(NEWBIE));
    }

    @Test
    @TestSecurity(user = "f2")
    @OidcSecurity(claims = @Claim(key = "sub", value = WRITER))
    void putPersistsAndGetReturnsSame() {
        given().contentType(ContentType.JSON).body(body("ro", "[7,1]"))
                .when().put("/me/settings")
                .then().statusCode(200)
                .body("language", equalTo("ro"))
                .body("notifications.reminderDays", contains(7, 1));
        given().when().get("/me/settings")
                .then().statusCode(200)
                .body("language", equalTo("ro"))
                .body("appearance", equalTo("dark"))
                .body("units.distance", equalTo("mi"))
                .body("units.currency", equalTo("EUR"))
                .body("notifications.documentDeadlines", equalTo(false))
                .body("notifications.reminderDays", contains(7, 1))
                .body("notifications.tireSeason", equalTo(false))
                .body("notifications.activityPassportViews", equalTo(true))
                .body("notifications.productNews", equalTo(true));
        // second PUT replaces (upsert), including an empty list
        given().contentType(ContentType.JSON).body(body("en", "[]"))
                .when().put("/me/settings").then().statusCode(200);
        given().when().get("/me/settings")
                .then().statusCode(200)
                .body("language", equalTo("en"))
                .body("notifications.reminderDays", empty());
        assertEquals(1, rows(WRITER));
    }

    @Test
    @TestSecurity(user = "f3")
    @OidcSecurity(claims = @Claim(key = "sub", value = BAD_LANG))
    void putRejectsUnknownLanguage() {
        given().contentType(ContentType.JSON).body(body("fr", "[7]"))
                .when().put("/me/settings")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"[14]", "[7,7]"})
    @TestSecurity(user = "f4")
    @OidcSecurity(claims = @Claim(key = "sub", value = BAD_DAYS))
    void putRejectsReminderDays(String days) {
        given().contentType(ContentType.JSON).body(body("ro", days))
                .when().put("/me/settings")
                .then().statusCode(400)
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "f5")
    @OidcSecurity(claims = @Claim(key = "sub", value = UNKNOWN))
    void putRejectsUnknownFieldsInBody() {
        String withExtra = body("ro", "[7]").replaceFirst("\\{", "{\"theme\":\"x\",");
        given().contentType(ContentType.JSON).body(withExtra)
                .when().put("/me/settings")
                .then().statusCode(400)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("validation-failed"));
        // like every other flag, tireSeason is required on PUT
        String withoutTireSeason = body("ro", "[7]").replace("\"tireSeason\":false,", "");
        given().contentType(ContentType.JSON).body(withoutTireSeason)
                .when().put("/me/settings").then().statusCode(400).body("code", equalTo("validation-failed"));
        String nestedExtra = body("ro", "[7]").replace("\"currency\":\"EUR\"", "\"currency\":\"EUR\",\"x\":1");
        given().contentType(ContentType.JSON).body(nestedExtra)
                .when().put("/me/settings").then().statusCode(400).body("code", equalTo("validation-failed"));
        assertEquals(0, rows(UNKNOWN));
    }

    @Test
    @TestSecurity(user = "f6")
    @OidcSecurity(claims = @Claim(key = "sub", value = ISO_A))
    void settingsAreIsolatedPerUser() {
        given().contentType(ContentType.JSON).body(body("ro", "[7]"))
                .when().put("/me/settings").then().statusCode(200);
        given().when().get("/me/settings").then().statusCode(200).body("language", equalTo("ro"));
        assertEquals(Settings.defaults(), getting.get(UUID.fromString(ISO_B)));
        assertEquals(0, rows(ISO_B));
    }

    @Test
    void settingsRequireAuth() {
        given().when().get("/me/settings").then().statusCode(401);
    }
}
