package com.vehiclepassport.server.passport;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.startsWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.vehiclepassport.server.event.application.port.in.AddEventCommand;
import com.vehiclepassport.server.event.application.port.in.AddEventUseCase;
import com.vehiclepassport.server.passport.application.port.in.CreatePassportUseCase;
import com.vehiclepassport.server.passport.application.port.in.PassportView;
import com.vehiclepassport.server.passport.application.port.in.RevokePassportLinkUseCase;
import com.vehiclepassport.server.passport.application.port.out.PassportRepositoryPort;
import com.vehiclepassport.server.passport.domain.model.Passport;
import com.vehiclepassport.server.passport.domain.model.PublicLink;
import com.vehiclepassport.server.testsupport.smoke.PersistenceProfile;
import com.vehiclepassport.server.vehicle.application.port.in.AssertActiveOwnerUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase;
import com.vehiclepassport.server.vehicle.application.port.in.RegisterVehicleUseCase.RegisterVehicleCommand;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(PersistenceProfile.class)
class PublicPassportResourceIT {

    private static final UUID OWNER = UUID.fromString("00000000-0000-0000-0000-0000000000f1");

    @Inject
    RegisterVehicleUseCase registering;
    @Inject
    AssertActiveOwnerUseCase owners;
    @Inject
    AddEventUseCase adding;
    @Inject
    CreatePassportUseCase creating;
    @Inject
    RevokePassportLinkUseCase revoking;
    @Inject
    PassportRepositoryPort passports;

    private void event(String vin, String date, int km, String notes) {
        adding.add(new AddEventCommand(OWNER, vin, "SERVICE", LocalDate.parse(date), km, new BigDecimal("450.50"),
                "RON", notes));
    }

    private static String tokenOf(PassportView view) {
        return view.publicUrl().substring(view.publicUrl().lastIndexOf('/') + 1);
    }

    /** A vehicle with two events, the first one carrying the given notes, and a passport for it. */
    private PassportView passport(String notes) {
        String vin = PassportFixtures.randomVin();
        registering.register(new RegisterVehicleCommand(OWNER, vin, "Dacia", "Duster", null, 2020, "DIESEL"));
        event(vin, "2025-03-01", 1000, notes);
        event(vin, "2025-04-01", 2000, null);
        return creating.create(OWNER, vin, null);
    }

    @Test
    void no_token_needed_200() {
        PassportView p = passport(null);
        given().when().get("/public/passports/" + tokenOf(p))
                .then().statusCode(200)
                .contentType(startsWith("application/json"))
                .body("algorithm", equalTo("SHA-256"))
                .body("hash", equalTo(p.hash()))
                .body("snapshot.vehicle.vin", equalTo(p.vin()))
                .body("snapshot.events.size()", equalTo(2));
    }

    @Test
    void every_response_has_cache_control_no_store() {
        PassportView ok = passport(null);
        PassportView gone = passport(null);
        revoking.revoke(OWNER, gone.id());
        String okUrl = "/public/passports/" + tokenOf(ok);
        String goneUrl = "/public/passports/" + tokenOf(gone);

        for (String url : new String[] {okUrl, okUrl + "/pdf", goneUrl, goneUrl + "/pdf",
                "/public/passports/unknown", "/public/passports/unknown/pdf"}) {
            given().when().get(url).then().header("Cache-Control", "no-store");
        }
    }

    @Test
    void unknown_revoked_expired_have_identical_status_and_body() {
        PassportView revoked = passport(null);
        revoking.revoke(OWNER, revoked.id());
        PassportView live = passport(null);
        Passport p = passports.findById(live.id()).orElseThrow();
        Passport expired = new Passport(UUID.randomUUID(), p.vin(), p.createdBy(), p.createdAt(), p.snapshot(),
                new PublicLink("expired-" + UUID.randomUUID(), Instant.now().minusSeconds(60), null), p.pdfKey());
        QuarkusTransaction.requiringNew().run(() -> passports.save(expired));

        for (String suffix : new String[] {"", "/pdf"}) {
            Response unknown = given().get("/public/passports/does-not-exist" + suffix);
            Response rev = given().get("/public/passports/" + tokenOf(revoked) + suffix);
            Response exp = given().get("/public/passports/" + expired.link().token() + suffix);
            assertEquals(404, unknown.statusCode());
            assertEquals(unknown.statusCode(), rev.statusCode());
            assertEquals(unknown.statusCode(), exp.statusCode());
            assertEquals(unknown.asString(), rev.asString());
            assertEquals(unknown.asString(), exp.asString());
            assertEquals(unknown.contentType(), rev.contentType());
            assertEquals(unknown.contentType(), exp.contentType());
            assertEquals("passport-not-found", unknown.jsonPath().getString("code"));
        }
    }

    @Test
    void pdf_is_application_pdf() {
        PassportView p = passport(null);
        byte[] body = given().when().get("/public/passports/" + tokenOf(p) + "/pdf")
                .then().statusCode(200).contentType("application/pdf").extract().asByteArray();
        assertEquals("%PDF", new String(body, 0, 4, StandardCharsets.US_ASCII));
    }

    @Test
    void pdf_404_when_revoked() {
        PassportView p = passport(null);
        revoking.revoke(OWNER, p.id());
        given().when().get("/public/passports/" + tokenOf(p) + "/pdf")
                .then().statusCode(404).body("code", equalTo("passport-not-found"));
    }

    @Test
    void response_contains_no_owner_identifiers() {
        PassportView p = passport(PassportFixtures.TRICKY_NOTES);
        String period = owners.assertActiveOwner(p.vin(), OWNER).periodId().toString();

        String raw = given().get("/public/passports/" + tokenOf(p)).then().statusCode(200).extract().asString();

        assertFalse(raw.contains(OWNER.toString()), "owner id leaked");
        assertFalse(raw.contains(period), "ownership period id leaked");
        assertFalse(raw.contains(p.id().toString()), "passport id leaked");
        for (String field : new String[] {"createdBy", "ownerId", "periodId", "ownedFrom", "ownedTo", "createdAt"}) {
            assertFalse(raw.contains("\"" + field + "\""), field + " leaked");
        }
    }

    @Test
    void hash_recomputed_from_served_snapshot_matches() throws Exception {
        PassportView p = passport(PassportFixtures.TRICKY_NOTES);

        Response response = given().get("/public/passports/" + tokenOf(p));
        // Decode the raw bytes as UTF-8 here, so a charset slip would corrupt the notes and break the hash.
        String body = new String(response.asByteArray(), StandardCharsets.UTF_8);
        ObjectMapper reader = new ObjectMapper().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
        JsonNode tree = reader.readTree(body);

        // Test-local copy of the canonical rules: Map input, sorted keys, no whitespace, plain big decimals.
        ObjectMapper canonical = new ObjectMapper().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .enable(JsonGenerator.Feature.WRITE_BIGDECIMAL_AS_PLAIN);
        Object snapshot = reader.treeToValue(tree.get("snapshot"), Object.class);
        String recomputed = canonical.writeValueAsString(snapshot);
        String sha = HexFormat.of()
                .formatHex(MessageDigest.getInstance("SHA-256").digest(recomputed.getBytes(StandardCharsets.UTF_8)));

        assertEquals(tree.get("hash").asText(), sha);
        assertEquals(p.hash(), sha);
        String notes = tree.get("snapshot").get("events").get(0).get("notes").asText();
        assertEquals(PassportFixtures.TRICKY_NOTES, notes);
        assertTrue(notes.contains("ă â î ș ț"));
    }
}
