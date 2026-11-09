package com.vehiclepassport.server.event;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.event.application.port.in.EventView;
import com.vehiclepassport.server.event.application.port.in.ReadVehicleHistoryUseCase;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventCommand;
import com.vehiclepassport.server.event.application.port.in.SaveConfirmedEventUseCase;
import com.vehiclepassport.server.testsupport.fake.FakeEventDocumentStorage;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.DecideOwnershipClaimUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.ClaimFiled;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import com.vehiclepassport.server.vehicle.application.port.in.ReleaseVehicleUseCase;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import io.quarkus.test.security.oidc.Claim;
import io.quarkus.test.security.oidc.OidcSecurity;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class EventResourceIT {

    static final String ME = "00000000-0000-0000-0000-0000000000e1";
    static final String OTHER = "00000000-0000-0000-0000-0000000000e2";
    static final String LATER = "00000000-0000-0000-0000-0000000000e3";

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String JSON_UTF8 = "application/json; charset=UTF-8";

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    ReleaseVehicleUseCase releasing;
    @Inject
    DecideOwnershipClaimUseCase deciding;
    @Inject
    AddEventUseCase adding;
    @Inject
    SaveConfirmedEventUseCase savingConfirmed;
    @Inject
    ReadVehicleHistoryUseCase history;
    @Inject
    FakeEventDocumentStorage storage;

    private String registerAs(String user) {
        String vin = EventTestVins.random();
        registerVin(user, vin);
        return vin;
    }

    private Object registerVin(String user, String vin) {
        return registering.register(new RegisterVehicleCommand(UUID.fromString(user), vin, "Dacia", "Duster", null,
                2020, "DIESEL"));
    }

    private EventView addAs(String user, String vin, String date, int km) {
        return adding.add(new AddEventCommand(UUID.fromString(user), vin, "SERVICE", LocalDate.parse(date), km,
                BigDecimal.TEN, "RON", null));
    }

    private static Map<String, Object> body(String date, int km, String notes) {
        return notes == null
                ? Map.of("type", "SERVICE", "date", date, "odometerKm", km, "costAmount", 450.5, "currency", "RON")
                : Map.of("type", "SERVICE", "date", date, "odometerKm", km, "costAmount", 450.5, "currency", "RON",
                        "notes", notes);
    }

    private UUID documented(String user, String vin, int km, String key) {
        return savingConfirmed.save(new SaveConfirmedEventCommand(UUID.fromString(user), vin, "SERVICE",
                LocalDate.parse("2025-03-01"), km, new BigDecimal("450.00"), "RON", "scan", null, key));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_201_user_confirmed() {
        String vin = registerAs(ME);
        given().contentType(JSON_UTF8).body(body("2025-03-01", 120000, null))
                .when().post("/vehicles/" + vin + "/events")
                .then().statusCode(201)
                .body("id", notNullValue())
                .body("type", equalTo("SERVICE"))
                .body("date", equalTo("2025-03-01"))
                .body("odometerKm", equalTo(120000))
                .body("costAmount", equalTo(450.5f))
                .body("currency", equalTo("RON"))
                .body("evidence", equalTo("USER_CONFIRMED"))
                .body("source", equalTo("MANUAL"))
                .body("documentPresent", equalTo(false))
                .body("details", nullValue());
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_future_date_422() {
        String vin = registerAs(ME);
        given().contentType(JSON_UTF8).body(body(LocalDate.now().plusDays(3).toString(), 1000, null))
                .when().post("/vehicles/" + vin + "/events")
                .then().statusCode(422)
                .contentType(startsWith("application/problem+json"))
                .body("code", equalTo("invalid-event"));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_invalid_shape_400() {
        String vin = registerAs(ME);
        given().contentType(JSON_UTF8).body(Map.of("type", "BOGUS", "date", "2025-03-01", "odometerKm", -1,
                        "costAmount", 1, "currency", "ron"))
                .when().post("/vehicles/" + vin + "/events")
                .then().statusCode(400)
                .body("code", equalTo("validation-failed"));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void post_contradiction_422_code() {
        String vin = registerAs(ME);
        addAs(ME, vin, "2025-03-01", 120000);
        given().contentType(JSON_UTF8).body(body("2025-04-01", 100000, null))
                .when().post("/vehicles/" + vin + "/events")
                .then().statusCode(422)
                .body("code", equalTo("odometer-inconsistent"));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void put_updates_and_delete_removes() {
        String vin = registerAs(ME);
        EventView created = addAs(ME, vin, "2025-03-01", 120000);
        given().contentType(JSON_UTF8).body(body("2025-03-01", 121000, "edited"))
                .when().put("/vehicles/" + vin + "/events/" + created.id())
                .then().statusCode(200)
                .body("odometerKm", equalTo(121000))
                .body("notes", equalTo("edited"));
        given().when().delete("/vehicles/" + vin + "/events/" + created.id()).then().statusCode(204);
        given().when().get("/vehicles/" + vin + "/timeline").then().statusCode(200).body("items", hasSize(0));
        given().when().delete("/vehicles/" + vin + "/events/" + created.id())
                .then().statusCode(404).body("code", equalTo("event-not-found"));
    }

    @Test
    @TestSecurity(user = "e3")
    @OidcSecurity(claims = @Claim(key = "sub", value = LATER))
    void edit_prior_period_403() {
        String vin = registerAs(ME);
        EventView created = addAs(ME, vin, "2025-03-01", 120000);
        releasing.release(vin, UUID.fromString(ME));
        registerVin(LATER, vin);
        given().contentType(JSON_UTF8).body(body("2025-03-01", 121000, null))
                .when().put("/vehicles/" + vin + "/events/" + created.id())
                .then().statusCode(403).body("code", equalTo("event-from-prior-owner"));
        given().when().delete("/vehicles/" + vin + "/events/" + created.id())
                .then().statusCode(403).body("code", equalTo("event-from-prior-owner"));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void foreign_vin_404() {
        String vin = registerAs(OTHER);
        given().contentType(JSON_UTF8).body(body("2025-03-01", 1000, null))
                .when().post("/vehicles/" + vin + "/events")
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));
        given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(404).body("code", equalTo("vehicle-not-found"));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void timeline_json_has_no_createdBy_or_periodId() throws Exception {
        String vin = registerAs(ME);
        addAs(ME, vin, "2025-03-01", 120000);
        documented(ME, vin, 121000, "docs/x.pdf");
        String json = given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200).body("items", hasSize(2)).extract().asString();
        assertNoIdentity(json);
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void bad_cursor_400() {
        String vin = registerAs(ME);
        given().queryParam("cursor", "not-a-cursor!").when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(400).body("code", equalTo("invalid-cursor"));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void limit_100_succeeds_and_absent_limit_defaults_to_20() {
        String vin = registerAs(ME);
        LocalDate start = LocalDate.parse("2023-01-01");
        for (int i = 0; i < 101; i++) {
            addAs(ME, vin, start.plusDays(i).toString(), 1000 + i);
        }
        given().queryParam("limit", 100).when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200).body("items", hasSize(100)).body("nextCursor", notNullValue());
        given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200).body("items", hasSize(20));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void limit_out_of_range_or_not_a_number_is_400_validation_failed() {
        String vin = registerAs(ME);
        for (String limit : new String[] {"0", "-5", "101", "abc", "1.5"}) {
            given().queryParam("limit", limit).when().get("/vehicles/" + vin + "/timeline")
                    .then().statusCode(400)
                    .contentType(startsWith("application/problem+json"))
                    .body("code", equalTo("validation-failed"));
        }
    }

    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void limit_over_100_is_clamped() {
        String vin = registerAs(ME);
        LocalDate start = LocalDate.parse("2023-01-01");
        for (int i = 0; i < 101; i++) {
            addAs(ME, vin, start.plusDays(i).toString(), 1000 + i);
        }
        given().queryParam("limit", 1000).when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200)
                .body("items", hasSize(100))
                .body("nextCursor", notNullValue());
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void timeline_pages_follow_next_cursor_without_gaps() {
        String vin = registerAs(ME);
        for (int i = 0; i < 5; i++) {
            addAs(ME, vin, "2025-03-01", 1000 + i);
        }
        Set<String> seen = new HashSet<>();
        String cursor = null;
        for (int page = 0; page < 3; page++) {
            var request = given().queryParam("limit", 2);
            if (cursor != null) {
                request = request.queryParam("cursor", cursor);
            }
            var response = request.when().get("/vehicles/" + vin + "/timeline").then().statusCode(200).extract();
            response.jsonPath().getList("items.id", String.class).forEach(id -> assertTrue(seen.add(id), id));
            cursor = response.jsonPath().getString("nextCursor");
        }
        assertEquals(5, seen.size());
        assertEquals(null, cursor);
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void notes_with_quotes_newlines_emoji_and_diacritics_round_trip_through_json() throws Exception {
        String vin = registerAs(ME);
        given().contentType(JSON_UTF8).body(JSON.writeValueAsBytes(body("2025-03-01", 1000, Notes.TRICKY)))
                .when().post("/vehicles/" + vin + "/events")
                .then().statusCode(201).body("notes", equalTo(Notes.TRICKY));
        String raw = given().when().get("/vehicles/" + vin + "/timeline").then().statusCode(200).extract().asString();
        assertEquals(Notes.TRICKY, JSON.readTree(raw).get("items").get(0).get("notes").asText());
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void document_200_for_creating_owner() {
        String vin = registerAs(ME);
        UUID id = documented(ME, vin, 1000, "docs/" + vin + ".pdf");
        storage.put("docs/" + vin + ".pdf", "%PDF-fake".getBytes(), "application/pdf");
        byte[] bytes = given().when().get("/vehicles/" + vin + "/events/" + id + "/document")
                .then().statusCode(200).contentType("application/pdf").extract().asByteArray();
        assertEquals("%PDF-fake", new String(bytes));
    }

    @Test
    @TestSecurity(user = "e1")
    @OidcSecurity(claims = @Claim(key = "sub", value = ME))
    void document_404_when_event_has_none() {
        String vin = registerAs(ME);
        EventView manual = addAs(ME, vin, "2025-03-01", 1000);
        given().when().get("/vehicles/" + vin + "/events/" + manual.id() + "/document")
                .then().statusCode(404).body("code", equalTo("event-not-found"));
        given().when().get("/vehicles/" + vin + "/events/" + UUID.randomUUID() + "/document")
                .then().statusCode(404).body("code", equalTo("event-not-found"));
    }

    @Test
    @TestSecurity(user = "e3")
    @OidcSecurity(claims = @Claim(key = "sub", value = LATER))
    void document_403_for_later_owner_but_timeline_shows_it() {
        String vin = registerAs(ME);
        UUID id = documented(ME, vin, 1000, "docs/prior.pdf");
        storage.put("docs/prior.pdf", new byte[] {1}, "application/pdf");
        releasing.release(vin, UUID.fromString(ME));
        registerVin(LATER, vin);
        given().when().get("/vehicles/" + vin + "/events/" + id + "/document")
                .then().statusCode(403).body("code", equalTo("document-restricted"));
        given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].documentPresent", equalTo(true));
    }

    @Test
    @TestSecurity(user = "e3")
    @OidcSecurity(claims = @Claim(key = "sub", value = LATER))
    void history_survives_release_and_exposes_no_identity() throws Exception {
        String vin = registerAs(ME);
        addAs(ME, vin, "2025-03-01", 1000);
        releasing.release(vin, UUID.fromString(ME));
        registerVin(LATER, vin);

        assertEquals(1, history.history(vin).size());
        String json = given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200).body("items", hasSize(1)).extract().asString();
        assertNoIdentity(json);
        assertEquals(1000, JSON.readTree(json).get("items").get(0).get("odometerKm").asInt());
    }

    @Test
    @TestSecurity(user = "e3")
    @OidcSecurity(claims = @Claim(key = "sub", value = LATER))
    void history_survives_ownership_transfer_and_exposes_no_identity() throws Exception {
        String vin = registerAs(ME);
        addAs(ME, vin, "2025-03-01", 1000);
        ClaimFiled filed = (ClaimFiled) registerVin(LATER, vin);
        deciding.approve(vin, filed.claimId(), UUID.fromString(ME));
        addAs(LATER, vin, "2025-04-01", 2000);

        assertEquals(2, history.history(vin).size());
        String json = given().when().get("/vehicles/" + vin + "/timeline")
                .then().statusCode(200).body("items", hasSize(2)).extract().asString();
        assertNoIdentity(json);
        assertFalse(json.contains(ME) || json.contains(LATER));
    }

    /** No key anywhere in the JSON may name an owner, creator or period, and no user id may appear as a value. */
    private static void assertNoIdentity(String json) throws Exception {
        Set<String> keys = new HashSet<>();
        collectKeys(JSON.readTree(json), keys);
        for (String forbidden : Set.of("createdBy", "ownerId", "periodId", "userId", "period")) {
            assertFalse(keys.contains(forbidden), forbidden + " in " + keys);
        }
        for (String user : Set.of(ME, OTHER, LATER)) {
            assertFalse(json.contains(user), "user id leaked: " + json);
        }
    }

    private static void collectKeys(JsonNode node, Set<String> keys) {
        if (node.isObject()) {
            node.fieldNames().forEachRemaining(keys::add);
            node.elements().forEachRemaining(child -> collectKeys(child, keys));
        } else if (node.isArray()) {
            node.elements().forEachRemaining(child -> collectKeys(child, keys));
        }
    }
}
